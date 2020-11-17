'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const SwaggerParser = require('@apidevtools/swagger-parser');
const request = require('request-promise-native');
const nconf = require('nconf');
const util = require('util');
const wait = util.promisify(setTimeout);

const db = require('./mocks/databasemock');
const helpers = require('./helpers');
const meta = require('../src/meta');
const user = require('../src/user');
const groups = require('../src/groups');
const categories = require('../src/categories');
const topics = require('../src/topics');
const plugins = require('../src/plugins');
const flags = require('../src/flags');
const messaging = require('../src/messaging');
const utils = require('../src/utils');

describe('API', async () => {
	let readApi = false;
	let writeApi = false;
	const readApiPath = path.resolve(__dirname, '../public/openapi/read.yaml');
	const writeApiPath = path.resolve(__dirname, '../public/openapi/write.yaml');
	let jar;
	let csrfToken;
	let setup = false;
	const unauthenticatedRoutes = ['/api/login', '/api/register'];	// Everything else will be called with the admin user

	const mocks = {
		head: {},
		get: {},
		post: {},
		put: {},
		delete: {
			'/users/{uid}/tokens/{token}': [
				{
					in: 'path',
					name: 'uid',
					example: 1,
				},
				{
					in: 'path',
					name: 'token',
					example: utils.generateUUID(),
				},
			],
			'/users/{uid}/sessions/{uuid}': [
				{
					in: 'path',
					name: 'uid',
					example: 1,
				},
				{
					in: 'path',
					name: 'uuid',
					example: '',	// to be defined below...
				},
			],
		},
	};

	async function dummySearchHook(data) {
		return [1];
	}

	after(async function () {
		plugins.unregisterHook('core', 'filter:search.query', dummySearchHook);
	});

	async function setupData() {
		if (setup) {
			return;
		}

		// Create sample users
		const adminUid = await user.create({ username: 'admin', password: '123456', email: 'test@example.org' });
		const unprivUid = await user.create({ username: 'unpriv', password: '123456', email: 'unpriv@example.org' });
		for (let x = 0; x < 4; x++) {
			// eslint-disable-next-line no-await-in-loop
			await user.create({ username: 'deleteme', password: '123456' });	// for testing of DELETE /users (uids 5, 6) and DELETE /user/:uid/account (uid 7)
		}
		await groups.join('administrators', adminUid);

		// Create sample group
		await groups.create({
			name: 'Test Group',
		});

		await meta.settings.set('core.api', {
			tokens: [{
				token: mocks.delete['/users/{uid}/tokens/{token}'][1].example,
				uid: 1,
				description: 'for testing of token deletion route',
				timestamp: Date.now(),
			}],
		});

		// Create a category
		const testCategory = await categories.create({ name: 'test' });

		// Post a new topic
		const testTopic = await topics.post({
			uid: adminUid,
			cid: testCategory.cid,
			title: 'Test Topic',
			content: 'Test topic content',
		});
		const unprivTopic = await topics.post({
			uid: unprivUid,
			cid: testCategory.cid,
			title: 'Test Topic 2',
			content: 'Test topic 2 content',
		});

		// Create a sample flag
		await flags.create('post', 1, unprivUid, 'sample reasons', Date.now());

		// Create a new chat room
		await messaging.newRoom(1, [2]);

		// Create an empty file to test DELETE /files
		fs.closeSync(fs.openSync(path.resolve(nconf.get('upload_path'), 'files/test.txt'), 'w'));

		const socketUser = require('../src/socket.io/user');
		// export data for admin user
		await socketUser.exportProfile({ uid: adminUid }, { uid: adminUid });
		await socketUser.exportPosts({ uid: adminUid }, { uid: adminUid });
		await socketUser.exportUploads({ uid: adminUid }, { uid: adminUid });
		// wait for export child process to complete
		await wait(5000);

		// Attach a search hook so /api/search is enabled
		plugins.registerHook('core', {
			hook: 'filter:search.query',
			method: dummySearchHook,
		});

		jar = await helpers.loginUser('admin', '123456');

		// Retrieve CSRF token using cookie, to test Write API
		const config = await request({
			url: nconf.get('url') + '/api/config',
			json: true,
			jar: jar,
		});
		csrfToken = config.csrf_token;

		setup = true;
	}

	it('should pass OpenAPI v3 validation', async () => {
		try {
			await SwaggerParser.validate(readApiPath);
			await SwaggerParser.validate(writeApiPath);
		} catch (e) {
			assert.ifError(e);
		}
	});

	readApi = await SwaggerParser.dereference(readApiPath);
	writeApi = await SwaggerParser.dereference(writeApiPath);

	generateTests(readApi, Object.keys(readApi.paths));
	generateTests(writeApi, Object.keys(writeApi.paths), writeApi.servers[0].url);

	function generateTests(api, paths, prefix) {
		// Iterate through all documented paths, make a call to it, and compare the result body with what is defined in the spec
		paths.forEach((path) => {
			const context = api.paths[path];
			let schema;
			let response;
			let url;
			let method;
			const headers = {};
			const qs = {};

			Object.keys(context).forEach((_method) => {
				if (api.info.title === 'NodeBB Read API' && _method !== 'get') {
					return;
				}

				it('should have each path parameter defined in its context', () => {
					method = _method;
					if (!context[method].parameters) {
						return;
					}

					const names = (path.match(/{[\w\-_]+}?/g) || []).map(match => match.slice(1, -1));
					assert(context[method].parameters.map(param => (param.in === 'path' ? param.name : null)).filter(Boolean).every(name => names.includes(name)), `${method.toUpperCase()} ${path} has parameter(s) in path that are not defined in schema`);
				});

				it('should have examples when parameters are present', () => {
					let parameters = context[method].parameters;
					let testPath = path;

					if (parameters) {
						// Use mock data if provided
						parameters = mocks[method][path] || parameters;

						parameters.forEach((param) => {
							assert(param.example !== null && param.example !== undefined, `${method.toUpperCase()} ${path} has parameters without examples`);

							switch (param.in) {
								case 'path':
									testPath = testPath.replace('{' + param.name + '}', param.example);
									break;
								case 'header':
									headers[param.name] = param.example;
									break;
								case 'query':
									qs[param.name] = param.example;
									break;
							}
						});
					}

					url = nconf.get('url') + (prefix || '') + testPath;
				});

				it('should contain a valid request body (if present) with application/json type if POST/PUT/DELETE', () => {
					if (['post', 'put', 'delete'].includes(method) && context[method].hasOwnProperty('requestBody')) {
						assert(context[method].requestBody);
						assert(context[method].requestBody.content);
						assert(context[method].requestBody.content['application/json']);
						assert(context[method].requestBody.content['application/json'].schema);
						assert(context[method].requestBody.content['application/json'].schema.properties);
					}
				});

				it('should resolve with a 200 when called', async () => {
					await setupData();

					if (csrfToken) {
						headers['x-csrf-token'] = csrfToken;
					}

					let body = {};
					if (context[method].hasOwnProperty('requestBody')) {
						body = buildBody(context[method].requestBody.content['application/json'].schema.properties);
					}

					try {
						// console.log(`calling ${method} ${url} with`, body);
						response = await request(url, {
							method: method,
							jar: !unauthenticatedRoutes.includes(path) ? jar : undefined,
							json: true,
							headers: headers,
							qs: qs,
							body: body,
						});
					} catch (e) {
						assert(!e, `${method.toUpperCase()} ${path} resolved with ${e.message}`);
					}
				});

				// Recursively iterate through schema properties, comparing type
				it('response should match schema definition', () => {
					const has200 = context[method].responses['200'];
					if (!has200) {
						return;
					}

					const hasJSON = has200.content && has200.content['application/json'];
					if (hasJSON) {
						schema = context[method].responses['200'].content['application/json'].schema;
						compare(schema, response, method.toUpperCase(), path, 'root');
					}

					// TODO someday: text/csv, binary file type checking?
				});

				it('should successfully re-login if needed', async () => {
					const reloginPaths = ['PUT /users/{uid}/password', 'DELETE /users/{uid}/sessions/{uuid}'];
					if (reloginPaths.includes(`${method.toUpperCase()} ${path}`)) {
						jar = await helpers.loginUser('admin', '123456');
						const sessionUUIDs = await db.getObject('uid:1:sessionUUID:sessionId');
						mocks.delete['/users/{uid}/sessions/{uuid}'][1].example = Object.keys(sessionUUIDs).pop();

						// Retrieve CSRF token using cookie, to test Write API
						const config = await request({
							url: nconf.get('url') + '/api/config',
							json: true,
							jar: jar,
						});
						csrfToken = config.csrf_token;
					}
				});
			});
		});
	}

	function buildBody(schema) {
		return Object.keys(schema).reduce((memo, cur) => {
			memo[cur] = schema[cur].example;
			return memo;
		}, {});
	}

	function compare(schema, response, method, path, context) {
		let required = [];
		const additionalProperties = schema.hasOwnProperty('additionalProperties');

		if (schema.allOf) {
			schema = schema.allOf.reduce((memo, obj) => {
				required = required.concat(obj.required ? obj.required : Object.keys(obj.properties));
				memo = { ...memo, ...obj.properties };
				return memo;
			}, {});
		} else if (schema.properties) {
			required = schema.required || Object.keys(schema.properties);
			schema = schema.properties;
		} else {
			// If schema contains no properties, check passes
			return;
		}

		// Compare the schema to the response
		required.forEach((prop) => {
			if (schema.hasOwnProperty(prop)) {
				assert(response.hasOwnProperty(prop), '"' + prop + '" is a required property (path: ' + method + ' ' + path + ', context: ' + context + ')');

				// Don't proceed with type-check if the value could possibly be unset (nullable: true, in spec)
				if (response[prop] === null && schema[prop].nullable === true) {
					return;
				}

				// Therefore, if the value is actually null, that's a problem (nullable is probably missing)
				assert(response[prop] !== null, '"' + prop + '" was null, but schema does not specify it to be a nullable property (path: ' + method + ' ' + path + ', context: ' + context + ')');

				switch (schema[prop].type) {
					case 'string':
						assert.strictEqual(typeof response[prop], 'string', '"' + prop + '" was expected to be a string, but was ' + typeof response[prop] + ' instead (path: ' + method + ' ' + path + ', context: ' + context + ')');
						break;
					case 'boolean':
						assert.strictEqual(typeof response[prop], 'boolean', '"' + prop + '" was expected to be a boolean, but was ' + typeof response[prop] + ' instead (path: ' + method + ' ' + path + ', context: ' + context + ')');
						break;
					case 'object':
						assert.strictEqual(typeof response[prop], 'object', '"' + prop + '" was expected to be an object, but was ' + typeof response[prop] + ' instead (path: ' + method + ' ' + path + ', context: ' + context + ')');
						compare(schema[prop], response[prop], method, path, context ? [context, prop].join('.') : prop);
						break;
					case 'array':
						assert.strictEqual(Array.isArray(response[prop]), true, '"' + prop + '" was expected to be an array, but was ' + typeof response[prop] + ' instead (path: ' + method + ' ' + path + ', context: ' + context + ')');

						if (schema[prop].items) {
							// Ensure the array items have a schema defined
							assert(schema[prop].items.type || schema[prop].items.allOf, '"' + prop + '" is defined to be an array, but its items have no schema defined (path: ' + method + ' ' + path + ', context: ' + context + ')');

							// Compare types
							if (schema[prop].items.type === 'object' || Array.isArray(schema[prop].items.allOf)) {
								response[prop].forEach((res) => {
									compare(schema[prop].items, res, method, path, context ? [context, prop].join('.') : prop);
								});
							} else if (response[prop].length) { // for now
								response[prop].forEach((item) => {
									assert.strictEqual(typeof item, schema[prop].items.type, '"' + prop + '" should have ' + schema[prop].items.type + ' items, but found ' + typeof items + ' instead (path: ' + method + ' ' + path + ', context: ' + context + ')');
								});
							}
						}
						break;
				}
			}
		});

		// Compare the response to the schema
		Object.keys(response).forEach((prop) => {
			if (additionalProperties) {	// All bets are off
				return;
			}

			assert(schema[prop], '"' + prop + '" was found in response, but is not defined in schema (path: ' + method + ' ' + path + ', context: ' + context + ')');
		});
	}
});

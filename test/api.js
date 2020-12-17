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
		meta.config.allowTopicsThumbnail = 1;

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

		// Create an empty file to test DELETE /files and thumb deletion
		fs.closeSync(fs.openSync(path.resolve(nconf.get('upload_path'), 'files/test.txt'), 'w'));
		fs.closeSync(fs.openSync(path.resolve(nconf.get('upload_path'), 'files/test.png'), 'w'));

		const socketUser = require('../src/socket.io/user');
		const socketAdmin = require('../src/socket.io/admin');
		// export data for admin user
		await socketUser.exportProfile({ uid: adminUid }, { uid: adminUid });
		await socketUser.exportPosts({ uid: adminUid }, { uid: adminUid });
		await socketUser.exportUploads({ uid: adminUid }, { uid: adminUid });
		await socketAdmin.user.exportUsersCSV({ uid: adminUid }, {});
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

	it('should grab all mounted routes and ensure a schema exists', async () => {
		const webserver = require('../src/webserver');
		const buildPaths = function (stack, prefix) {
			const paths = stack.map((dispatch) => {
				if (dispatch.route && dispatch.route.path && typeof dispatch.route.path === 'string') {
					if (!prefix && !dispatch.route.path.startsWith('/api/')) {
						return null;
					}
					return {
						method: Object.keys(dispatch.route.methods)[0],
						path: (prefix || '') + dispatch.route.path,
					};
				} else if (dispatch.name === 'router') {
					const prefix = dispatch.regexp.toString().replace('/^', '').replace('\\/?(?=\\/|$)/i', '').replace(/\\\//g, '/');
					return buildPaths(dispatch.handle.stack, prefix);
				}

				// Drop any that aren't actual routes (middlewares, error handlers, etc.)
				return null;
			});

			return paths.flat();
		};

		let paths = buildPaths(webserver.app._router.stack).filter(Boolean).map(function normalize(pathObj) {
			pathObj.path = pathObj.path.replace(/\/:([^\\/]+)/g, '/{$1}');
			return pathObj;
		});
		const exclusionPrefixes = ['/api/admin/plugins'];
		paths = paths.filter(function filterExclusions(path) {
			return path.method !== '_all' && !exclusionPrefixes.some(prefix => path.path.startsWith(prefix));
		});


		// For each express path, query for existence in read and write api schemas
		paths.forEach((pathObj) => {
			describe(`${pathObj.method.toUpperCase()} ${pathObj.path}`, () => {
				it('should be defined in schema docs', () => {
					let schema = readApi;
					if (pathObj.path.startsWith('/api/v3')) {
						schema = writeApi;
						pathObj.path = pathObj.path.replace('/api/v3', '');
					}

					// Don't check non-GET routes in Read API
					if (schema === readApi && pathObj.method !== 'get') {
						return;
					}

					const normalizedPath = pathObj.path.replace(/\/:([^\\/]+)/g, '/{$1}').replace(/\?/g, '');
					assert(schema.paths.hasOwnProperty(normalizedPath));
				});
			});
		});
	});

	// generateTests(readApi, Object.keys(readApi.paths));
	// generateTests(writeApi, Object.keys(writeApi.paths), writeApi.servers[0].url);

	function generateTests(api, paths, prefix) {
		// Iterate through all documented paths, make a call to it, and compare the result body with what is defined in the spec
		const pathLib = path;	// for calling path module from inside this forEach
		paths.forEach((path) => {
			const context = api.paths[path];
			let schema;
			let response;
			let url;
			let method;
			const headers = {};
			const qs = {};

			Object.keys(context).forEach((_method) => {
				// Only test GET routes in the Read API
				if (api.info.title === 'NodeBB Read API' && _method !== 'get') {
					return;
				}

				it('should have each path parameter defined in its context', () => {
					method = _method;
					if (!context[method].parameters) {
						return;
					}

					const names = (path.match(/{[\w\-_*]+}?/g) || []).map(match => match.slice(1, -1));
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

				it('should contain a valid request body (if present) with application/json or multipart/form-data type if POST/PUT/DELETE', () => {
					if (['post', 'put', 'delete'].includes(method) && context[method].hasOwnProperty('requestBody')) {
						const failMessage = `${method.toUpperCase()} ${path} has a malformed request body`;
						assert(context[method].requestBody, failMessage);
						assert(context[method].requestBody.content, failMessage);

						if (context[method].requestBody.content.hasOwnProperty('application/json')) {
							assert(context[method].requestBody.content['application/json'], failMessage);
							assert(context[method].requestBody.content['application/json'].schema, failMessage);
							assert(context[method].requestBody.content['application/json'].schema.properties, failMessage);
						} else if (context[method].requestBody.content.hasOwnProperty('multipart/form-data')) {
							assert(context[method].requestBody.content['multipart/form-data'], failMessage);
							assert(context[method].requestBody.content['multipart/form-data'].schema, failMessage);
							assert(context[method].requestBody.content['multipart/form-data'].schema.properties, failMessage);
						}
					}
				});

				it('should resolve with a 200 when called', async () => {
					await setupData();

					if (csrfToken) {
						headers['x-csrf-token'] = csrfToken;
					}

					let body = {};
					let type = 'json';
					if (context[method].hasOwnProperty('requestBody') && context[method].requestBody.content['application/json']) {
						body = buildBody(context[method].requestBody.content['application/json'].schema.properties);
					} else if (context[method].hasOwnProperty('requestBody') && context[method].requestBody.content['multipart/form-data']) {
						type = 'form';
					}

					try {
						if (type === 'json') {
							// console.log(`calling ${method} ${url} with`, body);
							response = await request(url, {
								method: method,
								jar: !unauthenticatedRoutes.includes(path) ? jar : undefined,
								json: true,
								headers: headers,
								qs: qs,
								body: body,
							});
						} else if (type === 'form') {
							response = await new Promise((resolve, reject) => {
								helpers.uploadFile(url, pathLib.join(__dirname, './files/test.png'), {}, jar, csrfToken, function (err, res, body) {
									if (err) {
										return reject(err);
									}
									resolve(body);
								});
							});
						}
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

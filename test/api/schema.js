'use strict';

const assert = require('assert');
const path = require('path');
const nconf = require('nconf');
const fs = require('fs');
const _ = require('lodash');
const SwaggerParser = require('@apidevtools/swagger-parser');
const jwt = require('jsonwebtoken');
const util = require('util');

const db = require('../mocks/databasemock');
const request = require('../../src/request');
const utils = require('../../src/utils');
const user = require('../../src/user');
const groups = require('../../src/groups');
const meta = require('../../src/meta');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const posts = require('../../src/posts');
const notifications = require('../../src/notifications');
const flags = require('../../src/flags');
const messaging = require('../../src/messaging');
const plugins = require('../../src/plugins');
const api = require('../../src/api');
const activitypub = require('../../src/activitypub');
const helpers = require('../helpers');

const { baseDir } = require('../../src/constants').paths;
const wait = util.promisify(setTimeout);
let readApi;
let writeApi;
let jar;
let csrfToken;
const unauthenticatedRoutes = ['/api/login', '/api/register']; // Everything else will be called with the admin user

async function dummySearchHook(data) {
	return [1];
}
async function dummyEmailerHook(data) {
	// pretend to handle sending emails
}
const mocks = {
	head: {},
	get: {
		'/api/email/unsubscribe/{token}': [
			{
				in: 'path',
				name: 'token',
				example: (() => jwt.sign({
					template: 'digest',
					uid: 1,
				}, nconf.get('secret')))(),
			},
		],
		'/api/confirm/{code}': [
			{
				in: 'path',
				name: 'code',
				example: '', // to be defined later...
			},
		],
		'/admin/tokens/{token}': [
			{
				in: 'path',
				name: 'token',
				example: '', // to be defined later...
			},
		],
	},
	post: {
		'/admin/tokens/{token}/roll': [
			{
				in: 'path',
				name: 'token',
				example: '', // to be defined later...
			},
		],
	},
	put: {
		'/groups/{slug}/pending/{uid}': [
			{
				in: 'path',
				name: 'slug',
				example: 'private-group',
			},
			{
				in: 'path',
				name: 'uid',
				example: '', // to be defined later...
			},
		],
		'/admin/tokens/{token}': [
			{
				in: 'path',
				name: 'token',
				example: '', // to be defined later...
			},
		],
	},
	patch: {},
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
				example: '', // to be defined below...
			},
		],
		'/posts/{pid}/diffs/{timestamp}': [
			{
				in: 'path',
				name: 'pid',
				example: '', // to be defined below...
			},
			{
				in: 'path',
				name: 'timestamp',
				example: '', // to be defined below...
			},
		],
		'/groups/{slug}/pending/{uid}': [
			{
				in: 'path',
				name: 'slug',
				example: 'private-group',
			},
			{
				in: 'path',
				name: 'uid',
				example: '', // to be defined later...
			},
		],
		'/groups/{slug}/invites/{uid}': [
			{
				in: 'path',
				name: 'slug',
				example: 'invitations-only',
			},
			{
				in: 'path',
				name: 'uid',
				example: '', // to be defined later...
			},
		],
		'/admin/tokens/{token}': [
			{
				in: 'path',
				name: 'token',
				example: '', // to be defined later...
			},
		],
	},
};

async function setupData() {
	// Create sample users
	const adminUid = await user.create({ username: 'admin', password: '123456', email: 'test@example.org' }, { emailVerification: 'verify' });
	const unprivUid = await user.create({ username: 'unpriv', password: '123456', email: 'unpriv@example.org' }, { emailVerification: 'verify' });
	const emailConfirmationUid = await user.create({ username: 'emailConf', email: 'emailConf@example.org' });

	mocks.get['/api/confirm/{code}'][0].example = await db.get(`confirm:byUid:${emailConfirmationUid}`);

	for (let x = 0; x < 4; x++) {
		// eslint-disable-next-line no-await-in-loop
		await user.create({ username: 'deleteme', password: '123456' }); // for testing of DELETE /users (uids 5, 6) and DELETE /user/:uid/account (uid 7)
	}
	await groups.join('administrators', adminUid);

	// Create api token for testing read/updating/deletion
	const token = await api.utils.tokens.generate({ uid: adminUid });
	mocks.get['/admin/tokens/{token}'][0].example = token;
	mocks.put['/admin/tokens/{token}'][0].example = token;
	mocks.delete['/admin/tokens/{token}'][0].example = token;

	// Create another token for testing rolling
	const token2 = await api.utils.tokens.generate({ uid: adminUid });
	mocks.post['/admin/tokens/{token}/roll'][0].example = token2;

	// Create sample group
	await groups.create({
		name: 'Test Group',
	});

	// Create private groups for pending/invitations
	const [pending1, pending2, inviteUid] = await Promise.all([
		user.create({ username: utils.generateUUID().slice(0, 8) }),
		user.create({ username: utils.generateUUID().slice(0, 8) }),
		user.create({ username: utils.generateUUID().slice(0, 8) }),
	]);
	mocks.put['/groups/{slug}/pending/{uid}'][1].example = pending1;
	mocks.delete['/groups/{slug}/pending/{uid}'][1].example = pending2;
	mocks.delete['/groups/{slug}/invites/{uid}'][1].example = inviteUid;
	await Promise.all(['private-group', 'invitations-only'].map(async (name) => groups.create({ name, private: true })));
	await groups.requestMembership('private-group', pending1);
	await groups.requestMembership('private-group', pending2);
	await groups.invite('invitations-only', inviteUid);

	await meta.settings.set('core.api', {
		tokens: [{
			token: mocks.delete['/users/{uid}/tokens/{token}'][1].example,
			uid: 1,
			description: 'for testing of token deletion route',
			timestamp: Date.now(),
		}],
	});
	meta.config.allowTopicsThumbnail = 1;
	meta.config.termsOfUse = 'I, for one, welcome our new test-driven overlords';
	meta.config.chatMessageDelay = 0;
	meta.config.activitypubEnabled = 1;

	// Create a category
	const testCategory = await categories.create({ name: 'test' });

	// Post a new topic
	await topics.post({
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
	await topics.post({
		uid: unprivUid,
		cid: testCategory.cid,
		title: 'Test Topic 3',
		content: 'Test topic 3 content',
	});

	// create a notification
	const notifObj = await notifications.create({
		nid: '1', // match nid in example in notifications/nid/read.yaml
		path: '/notifications',
		from: unprivUid,
		bodyShort: 'testing notification',
	});
	notifications.push(notifObj, adminUid);


	// Create a post diff
	await posts.edit({
		uid: adminUid,
		pid: unprivTopic.postData.pid,
		content: 'Test topic 2 edited content',
		req: {},
	});
	mocks.delete['/posts/{pid}/diffs/{timestamp}'][0].example = unprivTopic.postData.pid;
	mocks.delete['/posts/{pid}/diffs/{timestamp}'][1].example = (await posts.diffs.list(unprivTopic.postData.pid))[0];

	// Create a sample flag
	const { flagId } = await flags.create('post', 1, unprivUid, 'sample reasons', Date.now()); // deleted in DELETE /api/v3/flags/1
	await flags.appendNote(flagId, 1, 'test note', 1626446956652);
	await flags.create('post', 2, unprivUid, 'sample reasons', Date.now()); // for testing flag notes (since flag 1 deleted)

	// Create a new chat room & send a message
	const roomId = await messaging.newRoom(adminUid, { uids: [unprivUid] });
	await messaging.sendMessage({
		roomId,
		uid: adminUid,
		content: 'this is a chat message',
	});

	// Create an empty file to test DELETE /files and thumb deletion
	fs.closeSync(fs.openSync(path.resolve(nconf.get('upload_path'), 'files/test.txt'), 'w'));
	fs.copyFileSync(path.resolve(__dirname, '../../test/files/test.png'), path.resolve(nconf.get('upload_path'), 'files/test.png'));

	// Associate thumb with topic to test thumb reordering
	await topics.thumbs.associate({
		id: 2,
		path: 'files/test.png',
	});

	const socketAdmin = require('../../src/socket.io/admin');
	await Promise.all(['profile', 'posts', 'uploads'].map(async type => api.users.generateExport({ uid: adminUid }, { uid: adminUid, type })));
	await socketAdmin.user.exportUsersCSV({ uid: adminUid }, {});

	// wait for export child processes to complete
	const uploadPath = nconf.get('upload_path');
	const checkFiles = async (retries = 50) => {
		for (let i = 0; i < retries; i++) {
			// eslint-disable-next-line no-await-in-loop
			const files = await Promise.all([
				fs.promises.access(path.resolve(baseDir, 'build/export/users.csv')).then(() => true).catch(() => false),
				fs.promises.access(path.resolve(baseDir, `build/export/${adminUid}_profile.json`)).then(() => true).catch(() => false),
				fs.promises.access(path.resolve(baseDir, `build/export/${adminUid}_posts.csv`)).then(() => true).catch(() => false),
				fs.promises.access(path.resolve(baseDir, `build/export/${adminUid}_uploads.zip`)).then(() => true).catch(() => false),
			]);
			if (files.every(Boolean)) return;
			await wait(100);
		}
		throw new Error('Export files were not created in time');
	};
	await checkFiles();

	// Attach a search hook so /api/search is enabled
	plugins.hooks.register('core', {
		hook: 'filter:search.query',
		method: dummySearchHook,
	});
	// Attach an emailer hook so related requests do not error
	plugins.hooks.register('emailer-test', {
		hook: 'static:email.send',
		method: dummyEmailerHook,
	});

	// All tests run as admin user
	({ jar } = await helpers.loginUser('admin', '123456'));

	// Retrieve CSRF token using cookie, to test Write API
	csrfToken = await helpers.getCsrfToken(jar);

	// Pre-seed ActivityPub cache so contrived actor assertions pass
	activitypub._cache.set(`0;https://example.org/foobar`, {
		id: 'https://example.org/foobar',
		name: 'foobar',
		publicKey: {
			id: `https://example.org/foobar#key`,
			owner: `https://example.org/foobar`,
			publicKeyPem: 'secretcat',
		},
	});
}

describe('schema', () => {
	before(async function () {
		const readApiPath = path.resolve(__dirname, '../../public/openapi/read.yaml');
		const writeApiPath = path.resolve(__dirname, '../../public/openapi/write.yaml');
		this.readApi = await SwaggerParser.dereference(readApiPath);
		this.writeApi = await SwaggerParser.dereference(writeApiPath);

		await db.flushdb();
		await setupData();
	});

	after(async () => {
		plugins.hooks.unregister('core', 'filter:search.query', dummySearchHook);
		plugins.hooks.unregister('emailer-test', 'static:email.send');
	});

	it('read api', async function () {
		// Iterate through all documented paths, make a call to it,
		// and compare the result body with what is defined in the spec
		this.timeout(0);
		const paths = Object.keys(this.readApi.paths);
		const pathLib = path; // for calling path module from inside this forEach
		for(const p of paths) {
			// eslint-disable-next-line no-await-in-loop
			await executeTests(p, this.readApi, paths, pathLib);
		}
	});

	it('write api', async function () {
		// Iterate through all documented paths, make a call to it,
		// and compare the result body with what is defined in the spec
		this.timeout(0);
		const paths = Object.keys(this.writeApi.paths);
		const pathLib = path; // for calling path module from inside this forEach
		for(const p of paths) {
			// eslint-disable-next-line no-await-in-loop
			await executeTests(p, this.writeApi, paths, pathLib, this.writeApi.servers[0].url);
		};
	});

	async function executeTests(path, api, paths, pathLib, prefix) {
		const context = api.paths[path];
		let schema;
		let result;
		let url;
		const headers = {};
		const qs = {};

		await Object.keys(context).reduce(async (promise, _method) => {
			await promise;
			const method = _method;

			// Only test GET routes in the Read API
			if (api.info.title === 'NodeBB Read API' && _method !== 'get') {
				return;
			}

			// should have each path parameter defined in its context
			checkPathParameters(method, path, context);

			// should have examples when parameters are present
			prepareRequest(method, path, context);

			// should contain a valid request body (if present) with application/json or
			// multipart/form-data type if POST/PUT/DELETE
			validateRequestBody(method, path, context);

			// should not error out when called
			await executeRequest(method, path, context);

			// response status code should match one of the schema defined responses
			checkResponseStatusCode(method, path, context, result);

			// response body should match schema definition
			checkResponseBody(method, path, context, result);

			// should successfully re-login if needed
			await handleRelogin(method, path, context);
		}, Promise.resolve());

		function checkPathParameters(method, path, context) {
			if (context[method].parameters) {
				const pathParams = (path.match(/{[\w\-_*]+}?/g) || []).map(match => match.slice(1, -1));
				const schemaParams = context[method].parameters.map(param => (param.in === 'path' ? param.name : null)).filter(Boolean);
				assert(pathParams.every(param => schemaParams.includes(param)), `${method.toUpperCase()} ${path} has path parameters specified but not defined`);
				process.stdout.write('.');
			}
		}

		function prepareRequest(method, path, context) {
			let { parameters } = context[method];
			let testPath = path;

			if (parameters) {
				// Use mock data if provided
				parameters = mocks[method][path] || parameters;

				parameters.forEach((param) => {
					assert(param.example !== null && param.example !== undefined, `${method.toUpperCase()} ${path} has parameters without examples`);

					switch (param.in) {
						case 'path':
							testPath = testPath.replace(`{${param.name}}`, param.example);
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
			process.stdout.write('.');
		}

		function validateRequestBody(method, path, context) {
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
			process.stdout.write('.');
		}

		async function executeRequest(method, path, context) {
			if (csrfToken) {
				headers['x-csrf-token'] = csrfToken;
			}

			let body = {};
			let type = 'json';
			if (
				context[method].hasOwnProperty('requestBody') &&
				context[method].requestBody.required !== false &&
				context[method].requestBody.content['application/json']) {
				body = buildBody(context[method].requestBody.content['application/json'].schema.properties);
			} else if (context[method].hasOwnProperty('requestBody') && context[method].requestBody.content['multipart/form-data']) {
				type = 'form';
			}

			try {
				if (type === 'json') {
					const searchParams = new URLSearchParams(qs);
					result = await request[method](`${url}?${searchParams}`, {
						jar: !unauthenticatedRoutes.includes(path) ? jar : undefined,
						maxRedirect: 0,
						redirect: 'manual',
						headers: headers,
						body: body,
						timeout: 30000,
					});
				} else if (type === 'form') {
					result = await helpers.uploadFile(url, pathLib.join(__dirname, '../files/test.png'), {}, jar, csrfToken);
				}
			} catch (e) {
				assert(!e, `${method.toUpperCase()} ${path} errored with: ${e.message}`);
			}
			process.stdout.write('.');
		}

		function checkResponseStatusCode(method, path, context, result) {
			// HACK: allow HTTP 418 I am a teapot, for now   👇
			const { responses } = context[method];
			assert(
				responses.hasOwnProperty('418') ||
				Object.keys(responses).includes(String(result.response.statusCode)),
				`${method.toUpperCase()} ${path} sent back unexpected HTTP status code: ${result.response.statusCode}, body: ${JSON.stringify(result.body)} status: ${result.response.statusText}`,
			);
			process.stdout.write('.');
		}

		function checkResponseBody(method, path, context, result) {
			// Recursively iterate through schema properties, comparing type
			const http302 = context[method].responses['302'];
			if (http302 && result.response.statusCode === 302) {
				// Compare headers instead
				const expectedHeaders = Object.keys(http302.headers).reduce((memo, name) => {
					const value = http302.headers[name].schema.example;
					memo[name] = value.startsWith(nconf.get('relative_path')) ? value : nconf.get('relative_path') + value;
					return memo;
				}, {});

				for (const header of Object.keys(expectedHeaders)) {
					assert(result.response.headers[header.toLowerCase()]);
					assert.strictEqual(result.response.headers[header.toLowerCase()], expectedHeaders[header]);
				}
				return;
			}

			if (result.response.statusCode === 400 && context[method].responses['400']) {
				// TODO: check 400 schema to response.body?
				return;
			}

			const http200 = context[method].responses['200'];
			if (!http200) {
				return;
			}

			assert.strictEqual(result.response.statusCode, 200, `HTTP 200 expected (path: ${method} ${path}`);

			const hasJSON = http200.content && http200.content['application/json'];
			if (hasJSON) {
				schema = context[method].responses['200'].content['application/json'].schema;
				compare(schema, result.body, method.toUpperCase(), path, 'root');
			}

			// TODO someday: text/csv, binary file type checking?
			process.stdout.write('.');
		}

		async function handleRelogin(method, path, context) {
			const reloginPaths = ['GET /api/user/{userslug}/edit/email', 'PUT /users/{uid}/password', 'DELETE /users/{uid}/sessions/{uuid}'];
			if (reloginPaths.includes(`${method.toUpperCase()} ${path}`)) {
				({ jar } = await helpers.loginUser('admin', '123456'));
				let sessionIds = await db.getSortedSetRange('uid:1:sessions', 0, -1);
				let sessObj = await db.sessionStoreGet(sessionIds[0]);
				if (!sessObj) {
					// password changed so login with new pwd
					({ jar } = await helpers.loginUser('admin', '654321'));
					sessionIds = await db.getSortedSetRange('uid:1:sessions', 0, -1);
					sessObj = await db.sessionStoreGet(sessionIds[0]);
				}

				const { uuid } = sessObj.meta;
				mocks.delete['/users/{uid}/sessions/{uuid}'][1].example = uuid;

				// Retrieve CSRF token using cookie, to test Write API
				csrfToken = await helpers.getCsrfToken(jar);
			}
			process.stdout.write('.');
		}
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

		function flattenAllOf(obj) {
			return obj.reduce((memo, obj) => {
				if (obj.allOf) {
					obj = { properties: flattenAllOf(obj.allOf) };
				} else {
					try {
						required = required.concat(obj.required ? obj.required : Object.keys(obj.properties));
					} catch (e) {
						assert.fail(`Syntax error re: allOf, perhaps you allOf'd an array? (path: ${method} ${path}, context: ${context})`);
					}
				}

				return { ...memo, ...obj.properties };
			}, {});
		}

		if (schema.allOf) {
			schema = flattenAllOf(schema.allOf);
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
				assert(response.hasOwnProperty(prop), `"${prop}" is a required property (path: ${method} ${path}, context: ${context})`);

				// Don't proceed with type-check if the value could possibly be unset (nullable: true, in spec)
				if (response[prop] === null && schema[prop].nullable === true) {
					return;
				}

				// Therefore, if the value is actually null, that's a problem (nullable is probably missing)
				assert(response[prop] !== null, `"${prop}" was null, but schema does not specify it to be a nullable property (path: ${method} ${path}, context: ${context})`);

				switch (schema[prop].type) {
					case 'string':
						assert.strictEqual(typeof response[prop], 'string', `"${prop}" was expected to be a string, but was ${typeof response[prop]} instead (path: ${method} ${path}, context: ${context})`);
						break;
					case 'boolean':
						assert.strictEqual(typeof response[prop], 'boolean', `"${prop}" was expected to be a boolean, but was ${typeof response[prop]} instead (path: ${method} ${path}, context: ${context})`);
						break;
					case 'object': {
						let valid = ['object'];
						if (schema[prop].additionalProperties && schema[prop].additionalProperties.oneOf) {
							valid = schema[prop].additionalProperties.oneOf.map(({ type }) => type);
						}
						assert(valid.includes(typeof response[prop]), `"${prop}" was expected to be an object, but was ${typeof response[prop]} instead (path: ${method} ${path}, context: ${context})`);
						compare(schema[prop], response[prop], method, path, context ? [context, prop].join('.') : prop);
						break;
					}
					case 'array':
						assert.strictEqual(Array.isArray(response[prop]), true, `"${prop}" was expected to be an array, but was ${typeof response[prop]} instead (path: ${method} ${path}, context: ${context})`);

						if (schema[prop].items) {
							// Ensure the array items have a schema defined
							assert(schema[prop].items.type || schema[prop].items.allOf || schema[prop].items.anyOf || schema[prop].items.oneOf, `"${prop}" is defined to be an array, but its items have no schema defined (path: ${method} ${path}, context: ${context})`);

							// Compare types
							if (schema[prop].items.type === 'object' || Array.isArray(schema[prop].items.allOf || schema[prop].items.anyOf || schema[prop].items.oneOf)) {
								response[prop].forEach((res) => {
									compare(schema[prop].items, res, method, path, context ? [context, prop].join('.') : prop);
								});
							} else if (response[prop].length) { // for now
								response[prop].forEach((item) => {
									assert.strictEqual(typeof item, schema[prop].items.type, `"${prop}" should have ${schema[prop].items.type} items, but found ${typeof items} instead (path: ${method} ${path}, context: ${context})`);
								});
							}
						}
						break;
				}
			}
		});

		// Compare the response to the schema
		Object.keys(response).forEach((prop) => {
			if (additionalProperties) { // All bets are off
				return;
			}

			assert(schema[prop], `"${prop}" was found in response, but is not defined in schema (path: ${method} ${path}, context: ${context})`);
		});
	}
});
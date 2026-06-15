/* eslint-disable no-await-in-loop */
'use strict';

/**
 * Filtered execution: pass a keyword as the first positional argument after the test file path
 * to only run routes whose paths contain that keyword (case-insensitive).
 *   Example: npx mocha test/api/schema.js intents
 *   Runs only /api/intents/{intent} and /intents/query/{handle} (14 tests instead of ~2,450).
 *   Omit the argument to run all tests.
 */

const assert = require('assert');
const path = require('path');
const nconf = require('nconf');
const fs = require('fs');
const _ = require('lodash');
const SwaggerParser = require('@apidevtools/swagger-parser');
const jwt = require('jsonwebtoken');
const util = require('util');
const Ajv = require('ajv');

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

const ajv = new Ajv({ allErrors: true, strict: false });
const { baseDir } = require('../../src/constants').paths;
const wait = util.promisify(setTimeout);
let jar;
let csrfToken;
const unauthenticatedRoutes = ['/api/login', '/api/register']; // Everything else will be called with the admin user

let readApi;
let writeApi;
const readApiPath = path.resolve(__dirname, '../files/readApi.json');
const writeApiPath = path.resolve(__dirname, '../files/writeApi.json');
try {
	readApi = JSON.parse(fs.readFileSync(readApiPath, 'utf8'));
	writeApi = JSON.parse(fs.readFileSync(writeApiPath, 'utf8'));
} catch (e) {
	throw new Error('Run test/api/schema-bootstrap.mjs first.');
}

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
		const getFileStats = async () => {
			const paths = [
				path.resolve(baseDir, 'build/export/users.csv'),
				path.resolve(baseDir, `build/export/${adminUid}_profile.json`),
				path.resolve(baseDir, `build/export/${adminUid}_posts.csv`),
				path.resolve(baseDir, `build/export/${adminUid}_uploads.zip`),
			];

			const results = await Promise.all(paths.map(async (p) => {
				try {
					const stats = await fs.promises.stat(p);
					return { exists: true, size: stats.size };
				} catch (e) {
					return { exists: false, size: 0 };
				}
			}));

			return results;
		};

		for (let i = 0; i < retries; i++) {
			const firstCheck = await getFileStats();
			if (firstCheck.every((f) => f.exists)) {
				await wait(500); // Wait a bit to see if size changes
				const secondCheck = await getFileStats();
				if (secondCheck.every((f, idx) => f.size === firstCheck[idx].size)) {
					return;
				}
			}
			await wait(100);
		}
		throw new Error('Export files were not created or finished writing in time');
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

	// Pre-seed ActivityPub & webfinger cache so contrived actor assertions pass
	activitypub._cache.set(`0;https://example.org/foobar`, {
		id: 'https://example.org/foobar',
		name: 'foobar',
		publicKey: {
			id: `https://example.org/foobar#key`,
			owner: `https://example.org/foobar`,
			publicKeyPem: 'secretcat',
		},
	});
	activitypub.helpers._webfingerCache.set('foobar@example.org', { actorUri: 'https://example.org/foobar' });
}

describe('schema', () => {
	before(async function () {
		await db.setupMockDefaults();
		await setupData();
	});

	after(async () => {
		plugins.hooks.unregister('core', 'filter:search.query', dummySearchHook);
		plugins.hooks.unregister('emailer-test', 'static:email.send');

		await fs.promises.unlink(readApiPath);
		await fs.promises.unlink(writeApiPath);
	});

	// todo: path filtering to run one/multiple routes, gh#14206
	generateTests(readApi);
	generateTests(writeApi, writeApi.servers[0].url);

	async function generateTests(api, prefix) {
		const paths = Object.keys(api.paths);
		const filterPattern = process.argv[3];

		paths.forEach((path) => {
			if (filterPattern && !path.toLowerCase().includes(filterPattern.toLowerCase())) {
				return;
			}

			const context = api.paths[path];
			let schema;
			const headers = {};
			const qs = {};

			Object.keys(context).forEach((method) => {
				// Only test GET routes in the Read API
				if (api.info.title === 'NodeBB Read API' && method !== 'get') {
					return;
				}

				it('should have each path parameter defined in its context', () => {
					checkPathParameters(method, path, context);
				});

				it('should have examples when parameters are present', function () {
					const { headers, url, qs } = prepareRequest(method, path, context, prefix);
					this.headers = headers;
					this.url = url;
					this.qs = qs;
				});

				it('should contain a valid request body (if present) with application/json or multipart/form-data type if POST/PUT/DELETE', () => {
					validateRequestBody(method, path, context);
				});

				it('should not error out when called', async function () {
					// Uncomment if there is a failing test
					// console.log(this.url, method, path);
					this.result = await executeRequest.call(this, method, path, context);
				});

				it('response status code should match one of the schema defined responses', function () {
					checkResponseStatusCode.call(this, method, path, context);
				});

				it('response body should match schema definition', function () {
					checkResponseBody.call(this, method, path, context);
				});

				it('should successfully re-login if needed', async function () {
					await handleRelogin(method, path, context);
				});
			});
		});
	}

	function checkPathParameters(method, path, context) {
		if (context[method].parameters) {
			const pathParams = (path.match(/{[\w\-_*]+}?/g) || []).map(match => match.slice(1, -1));
			const schemaParams = context[method].parameters.map(param => (param.in === 'path' ? param.name : null)).filter(Boolean);
			assert(pathParams.every(param => schemaParams.includes(param)), `${method.toUpperCase()} ${path} has path parameters specified but not defined`);
		}
	}

	function prepareRequest(method, path, context, prefix) {
		let { parameters } = context[method];
		let testPath = path;
		const headers = {};
		const qs = {};

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

		return {
			url: nconf.get('url') + (prefix || '') + testPath,
			headers,
			qs,
		};
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
	}

	async function executeRequest(method, _path, context) {
		if (csrfToken) {
			this.headers['x-csrf-token'] = csrfToken;
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
			let result;

			if (type === 'json') {
				const searchParams = new URLSearchParams(this.qs);
				result = await request[method](`${this.url}?${searchParams}`, {
					jar: !unauthenticatedRoutes.includes(_path) ? jar : undefined,
					maxRedirect: 0,
					redirect: 'manual',
					headers: this.headers,
					body: body,
					timeout: 30000,
				});
			} else if (type === 'form') {
				result = await helpers.uploadFile(this.url, path.join(__dirname, '../files/test.png'), {}, jar, csrfToken);
			}

			return result;
		} catch (e) {
			assert(!e, `${method.toUpperCase()} ${_path} errored with: ${e.message}`);
		}
	}

	function checkResponseStatusCode(method, path, context) {
		// HACK: allow HTTP 418 I am a teapot, for now   👇
		const { responses } = context[method];
		assert(
			responses.hasOwnProperty('418') ||
			Object.keys(responses).includes(String(this.result.response.statusCode)),
			`${method.toUpperCase()} ${path} sent back unexpected HTTP status code: ${this.result.response.statusCode}, body: ${JSON.stringify(this.result.body)} status: ${this.result.response.statusText}`,
		);
	}

	function checkResponseBody(method, path, context) {
		// Recursively iterate through schema properties, comparing type
		const http302 = context[method].responses['302'];
		if (http302 && this.result.response.statusCode === 302) {
			// Compare headers instead
			const expectedHeaders = Object.keys(http302.headers).reduce((memo, name) => {
				const value = http302.headers[name].schema.example;
				memo[name] = value.startsWith(nconf.get('relative_path')) ? value : nconf.get('relative_path') + value;
				return memo;
			}, {});

			for (const header of Object.keys(expectedHeaders)) {
				assert(this.result.response.headers[header.toLowerCase()]);
				assert.strictEqual(this.result.response.headers[header.toLowerCase()], expectedHeaders[header]);
			}
			return;
		}

		if (this.result.response.statusCode === 400 && context[method].responses['400']) {
			// TODO: check 400 schema to response.body?
			return;
		}

		const http200 = context[method].responses['200'];
		if (!http200) {
			return;
		}

		assert.strictEqual(this.result.response.statusCode, 200, `HTTP 200 expected (path: ${method} ${path})`);

		const hasJSON = http200.content && http200.content['application/json'];
		if (hasJSON) {
			this.schema = context[method].responses['200'].content['application/json'].schema;
			validateSchema(this.schema, this.result.body, method.toUpperCase(), path);
		}

		// TODO someday: text/csv, binary file type checking?
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
	}

	function buildBody(schema) {
		return Object.keys(schema).reduce((memo, cur) => {
			memo[cur] = schema[cur].example;
			return memo;
		}, {});
	}

	function validateSchema(schema, data, method, path) {
		let validate;
		try {
			validate = ajv.compile(schema);
		} catch (err) {
			assert.fail(`Schema is invalid (path: ${method} ${path}): ${err.message}`);
		}

		if (!validate(data)) {
			const errorMessages = validate.errors.map(err => {
				const instancePath = err.instancePath || 'root';
				return `"${instancePath}" ${err.message} (path: ${method} ${path})`;
			}).join('\n');
			console.log(path, JSON.stringify(data, null, 2));
			assert.fail(`Schema validation failed (path: ${method} ${path}):\n${errorMessages}`);
		}
	}
});
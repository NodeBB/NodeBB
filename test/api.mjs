'use strict';

import _ from 'lodash';
import assert from 'assert';
import { join as pathJoin, resolve as pathResolve, dirname } from 'path';
import { closeSync, openSync, writeFileSync } from 'fs';
import SwaggerParser from '@apidevtools/swagger-parser';
import nconf from 'nconf';
import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

import request from '../src/request.js';
import db from './mocks/databasemock.mjs';
import helpers from './helpers/index.js';
import meta from '../src/meta/index.js';
import user from '../src/user/index.js';
import groups from '../src/groups/index.js';
import categories from '../src/categories/index.js';
import topics from '../src/topics/index.js';
import posts from '../src/posts/index.js';
import plugins from '../src/plugins/index.js';
import flags from '../src/flags.js';
import messaging from '../src/messaging/index.js';
import activitypub from '../src/activitypub/index.js';
import utils from '../src/utils.js';
import api from '../src/api/index.js';

const wait = promisify(setTimeout);

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readApiPath = pathResolve(__dirname, '../public/openapi/read.yaml');
const writeApiPath = pathResolve(__dirname, '../public/openapi/write.yaml');
const readApi = await SwaggerParser.dereference(readApiPath);
const writeApi = await SwaggerParser.dereference(writeApiPath);

const webserver = await import('../src/webserver.js');
const buildPaths = function (stack, prefix) {
	const paths = stack.map((dispatch) => {
		if (
			dispatch.route &&
			dispatch.route.path &&
			typeof dispatch.route.path === 'string'
		) {
			if (!prefix && !dispatch.route.path.startsWith('/api/')) {
				return null;
			}

			if (prefix === nconf.get('relative_path')) {
				prefix = '';
			}

			return {
				method: Object.keys(dispatch.route.methods)[0],
				path: (prefix || '') + dispatch.route.path,
			};
		} else if (dispatch.name === 'router') {
			const prefix = dispatch.regexp
				.toString()
				.replace('/^', '')
				.replace('\\/?(?=\\/|$)/i', '')
				.replace(/\\\//g, '/');
			return buildPaths(dispatch.handle.stack, prefix);
		}

		return null;
	});

	return _.flatten(paths);
};

let paths = buildPaths(webserver.app._router.stack)
	.filter(Boolean)
	.map((pathObj) => {
		pathObj.path = pathObj.path.replace(/\/:([^\\/]+)/g, '/{$1}');
		return pathObj;
	});
const exclusionPrefixes = [
	'/api/admin/plugins',
	'/api/compose',
	'/debug',
	'/api/user/{userslug}/theme',
];
paths = paths.filter(
	(path) =>
		path.method !== '_all' &&
		!exclusionPrefixes.some((prefix) => path.path.startsWith(prefix))
);



describe('API', function () {
	let jar;
	let csrfToken;
	let setup = false;
	const unauthenticatedRoutes = ['/api/login', '/api/register'];

	const mocks = {
		head: {},
		get: {
			'/api/email/unsubscribe/{token}': [
				{
					in: 'path',
					name: 'token',
					example: jwt.sign(
						{
							template: 'digest',
							uid: 1,
						},
						nconf.get('secret')
					),
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

	async function dummySearchHook(data) {
		return [1];
	}
	async function dummyEmailerHook(data) {
		// pretend to handle sending emails
	}

	after(async () => {
		plugins.hooks.unregister(
			'core',
			'filter:search.query',
			dummySearchHook
		);
		plugins.hooks.unregister('emailer-test', 'static:email.send');
	});

	async function setupData() {
		if (setup) {
			return;
		}

		// Create sample users
		const adminUid = await user.create({
			username: 'admin',
			password: '123456',
		});
		const unprivUid = await user.create({
			username: 'unpriv',
			password: '123456',
		});
		const emailConfirmationUid = await user.create({
			username: 'emailConf',
			email: 'emailConf@example.org',
		});
		await user.setUserField(adminUid, 'email', 'test@example.org');
		await user.setUserField(unprivUid, 'email', 'unpriv@example.org');
		await user.email.confirmByUid(adminUid);
		await user.email.confirmByUid(unprivUid);
		mocks.get['/api/confirm/{code}'][0].example = await db.get(
			`confirm:byUid:${emailConfirmationUid}`
		);

		for (let x = 0; x < 4; x++) {
			await user.create({ username: 'deleteme', password: '123456' });
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
		await Promise.all(
			['private-group', 'invitations-only'].map(async (name) => {
				await groups.create({ name, private: true });
			})
		);
		await groups.requestMembership('private-group', pending1);
		await groups.requestMembership('private-group', pending2);
		await groups.invite('invitations-only', inviteUid);

		await meta.settings.set('core.api', {
			tokens: [
				{
					token: mocks.delete['/users/{uid}/tokens/{token}'][1].example,
					uid: 1,
					description: 'for testing of token deletion route',
					timestamp: Date.now(),
				},
			],
		});
		meta.config.allowTopicsThumbnail = 1;
		meta.config.termsOfUse =
			'I, for one, welcome our new test-driven overlords';
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

		// Create a post diff
		await posts.edit({
			uid: adminUid,
			pid: unprivTopic.postData.pid,
			content: 'Test topic 2 edited content',
			req: {},
		});
		mocks.delete['/posts/{pid}/diffs/{timestamp}'][0].example =
			unprivTopic.postData.pid;
		mocks.delete['/posts/{pid}/diffs/{timestamp}'][1].example = (
			await posts.diffs.list(unprivTopic.postData.pid)
		)[0];

		// Create a sample flag
		const { flagId } = await flags.create(
			'post',
			1,
			unprivUid,
			'sample reasons',
			Date.now()
		);
		await flags.appendNote(flagId, 1, 'test note', 1626446956652);
		await flags.create('post', 2, unprivUid, 'sample reasons', Date.now());

		// Create a new chat room
		await messaging.newRoom(adminUid, { uids: [unprivUid] });

		// Create an empty file to test DELETE /files and thumb deletion
		closeSync(
			openSync(pathJoin(nconf.get('upload_path'), 'files/test.txt'), 'w')
		);
		closeSync(
			openSync(pathJoin(nconf.get('upload_path'), 'files/test.png'), 'w')
		);

		// Associate thumb with topic to test thumb reordering
		await topics.thumbs.associate({
			id: 2,
			path: 'files/test.png',
		});

		const socketAdmin = await import('../src/socket.io/admin.js');
		await Promise.all(
			['profile', 'posts', 'uploads'].map(async (type) =>
				api.users.generateExport({ uid: adminUid }, { uid: adminUid, type })
			)
		);
		await socketAdmin.user.exportUsersCSV({ uid: adminUid }, {});
		await wait(5000);

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

		setup = true;
	}

	it('should pass OpenAPI v3 validation', async function () {
		try {
			await SwaggerParser.validate(readApiPath);
			await SwaggerParser.validate(writeApiPath);
		} catch (e) {
			assert.ifError(e);
		}
	});

	describe('it should grab all mounted routes and ensure a schema exists', function () {
		paths.forEach((pathObj) => {
			describe(`${pathObj.method.toUpperCase()} ${pathObj.path}`, function () {
				it('should be defined in schema docs', function () {
					let schema = readApi;
					if (pathObj.path.startsWith('/api/v3')) {
						schema = writeApi;
						pathObj.path = pathObj.path.replace('/api/v3', '');
					}

					if (schema === readApi && pathObj.method !== 'get') {
						return;
					}

					const normalizedPath = pathObj.path
						.replace(/\/:([^\\/]+)/g, '/{$1}')
						.replace(/\?/g, '');
					assert(
						schema.paths.hasOwnProperty(normalizedPath),
						`${pathObj.path} is not defined in schema docs`
					);
					assert(
						schema.paths[normalizedPath].hasOwnProperty(pathObj.method),
						`${pathObj.path} was found in schema docs, but ${pathObj.method.toUpperCase()} method is not defined`
					);
				});
			});
		});
	});

	generateTests(readApi, Object.keys(readApi.paths));
	generateTests(writeApi, Object.keys(writeApi.paths), writeApi.servers[0].url);

	function generateTests(api, paths, prefix) {
		describe(`"${api.info.title}" API`, function () {
			paths.forEach((path) => {
				const context = api.paths[path];
				let schema;
				let result;
				let url;
				let method;
				const headers = {};
				const qs = {};

				describe(`${path}`, function () {

					Object.keys(context).forEach((_method) => {
						if (api.info.title === 'NodeBB Read API' && _method !== 'get') {
							return;
						}

						describe(`${_method.toUpperCase()}`, function () {
							it('should have each path parameter defined in its context', function () {
								method = _method;
								if (!context[method].parameters) {
									return;
								}

								const pathParams =
									(path.match(/{[\w\-_*]+}?/g) || []).map((match) =>
										match.slice(1, -1)
									);
								const schemaParams = context[method].parameters
									.map((param) => (param.in === 'path' ? param.name : null))
									.filter(Boolean);
								assert(
									pathParams.every((param) => schemaParams.includes(param)),
									`${method.toUpperCase()} ${path} has path parameters specified but not defined`
								);
							});

							it('should have examples when parameters are present', function () {
								let { parameters } = context[method];
								let testPath = path;

								if (parameters) {
									parameters = mocks[method][path] || parameters;

									parameters.forEach((param) => {
										assert(
											param.example !== null && param.example !== undefined,
											`${method.toUpperCase()} ${path} has parameters without examples`
										);

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
							});

							it('should contain a valid request body (if present) with application/json or multipart/form-data type if POST/PUT/DELETE', function () {
								if (
									['post', 'put', 'delete'].includes(method) &&
									context[method].hasOwnProperty('requestBody')
								) {
									const failMessage = `${method.toUpperCase()} ${path} has a malformed request body`;
									assert(context[method].requestBody, failMessage);
									assert(context[method].requestBody.content, failMessage);

									if (
										context[method].requestBody.content.hasOwnProperty(
											'application/json'
										)
									) {
										assert(
											context[method].requestBody.content['application/json'],
											failMessage
										);
										assert(
											context[method].requestBody.content['application/json'].schema,
											failMessage
										);
										assert(
											context[method].requestBody.content['application/json'].schema
												.properties,
											failMessage
										);
									} else if (
										context[method].requestBody.content.hasOwnProperty(
											'multipart/form-data'
										)
									) {
										assert(
											context[method].requestBody.content['multipart/form-data'],
											failMessage
										);
										assert(
											context[method].requestBody.content['multipart/form-data']
												.schema,
											failMessage
										);
										assert(
											context[method].requestBody.content['multipart/form-data'].schema
												.properties,
											failMessage
										);
									}
								}
							});

							it('should not error out when called', async function () {
								await setupData();

								if (csrfToken) {
									headers['x-csrf-token'] = csrfToken;
								}

								let body = {};
								let type = 'json';
								if (
									context[method].hasOwnProperty('requestBody') &&
									context[method].requestBody.required !== false &&
									context[method].requestBody.content['application/json']
								) {
									body = buildBody(
										context[method].requestBody.content['application/json'].schema
											.properties
									);
								} else if (
									context[method].hasOwnProperty('requestBody') &&
									context[method].requestBody.content['multipart/form-data']
								) {
									type = 'form';
								}

								try {
									if (type === 'json') {
										const searchParams = new URLSearchParams(qs);
										result = await request[method](
											`${url}?${searchParams}`,
											{
												jar: !unauthenticatedRoutes.includes(path) ? jar : undefined,
												maxRedirect: 0,
												redirect: 'manual',
												headers: headers,
												body: body,
											}
										);
									} else if (type === 'form') {
										result = await helpers.uploadFile(
											url,
											pathJoin(__dirname, './files/test.png'),
											{},
											jar,
											csrfToken
										);
									}
								} catch (e) {
									assert(
										!e,
										`${method.toUpperCase()} ${path} errored with: ${e.message}`
									);
								}
							});

							it('response status code should match one of the schema defined responses', function () {
								const { responses } = context[method];
								assert(
									responses.hasOwnProperty('418') ||
									Object.keys(responses).includes(String(result.response.statusCode)),
									`${method.toUpperCase()} ${path} sent back unexpected HTTP status code: ${result.response.statusCode}`
								);
							});

							it('response body should match schema definition', function () {
								const http302 = context[method].responses['302'];
								if (http302 && result.response.statusCode === 302) {
									const expectedHeaders = Object.keys(http302.headers).reduce(
										(memo, name) => {
											const value = http302.headers[name].schema.example;
											memo[name] = value.startsWith(nconf.get('relative_path'))
												? value
												: nconf.get('relative_path') + value;
											return memo;
										},
										{}
									);

									for (const header of Object.keys(expectedHeaders)) {
										assert(result.response.headers[header.toLowerCase()]);
										assert.strictEqual(
											result.response.headers[header.toLowerCase()],
											expectedHeaders[header]
										);
									}
									return;
								}

								if (
									result.response.statusCode === 400 &&
									context[method].responses['400']
								) {
									return;
								}

								const http200 = context[method].responses['200'];
								if (!http200) {
									return;
								}

								assert.strictEqual(
									result.response.statusCode,
									200,
									`HTTP 200 expected (path: ${method} ${path}`
								);

								const hasJSON = http200.content && http200.content['application/json'];
								if (hasJSON) {
									schema =
										context[method].responses['200'].content['application/json']
											.schema;
									compare(schema, result.body, method.toUpperCase(), path, 'root');
								}
							});

							it('should successfully re-login if needed', async function () {
								const reloginPaths = [
									'GET /api/user/{userslug}/edit/email',
									'PUT /users/{uid}/password',
									'DELETE /users/{uid}/sessions/{uuid}',
								];
								if (reloginPaths.includes(`${method.toUpperCase()} ${path}`)) {
									({ jar } = await helpers.loginUser('admin', '123456'));
									let sessionIds = await db.getSortedSetRange(
										'uid:1:sessions',
										0,
										-1
									);
									let sessObj = await db.sessionStoreGet(sessionIds[0]);
									if (!sessObj) {
										({ jar } = await helpers.loginUser('admin', '654321'));
										sessionIds = await db.getSortedSetRange('uid:1:sessions', 0, -1);
										sessObj = await db.sessionStoreGet(sessionIds[0]);
									}

									const { uuid } = sessObj.meta;
									mocks.delete['/users/{uid}/sessions/{uuid}'][1].example = uuid;

									csrfToken = await helpers.getCsrfToken(jar);
								}
							});
						});
					});
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

		function flattenAllOf(obj) {
			return obj.reduce((memo, obj) => {
				if (obj.allOf) {
					obj = { properties: flattenAllOf(obj.allOf) };
				} else {
					try {
						required = required.concat(
							obj.required ? obj.required : Object.keys(obj.properties)
						);
					} catch (e) {
						assert.fail(
							`Syntax error re: allOf, perhaps you allOf'd an array? (path: ${method} ${path}, context: ${context})`
						);
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
			return;
		}

		required.forEach((prop) => {
			if (schema.hasOwnProperty(prop)) {
				assert(
					response.hasOwnProperty(prop),
					`"${prop}" is a required property (path: ${method} ${path}, context: ${context})`
				);

				if (response[prop] === null && schema[prop].nullable === true) {
					return;
				}

				assert(
					response[prop] !== null,
					`"${prop}" was null, but schema does not specify it to be a nullable property (path: ${method} ${path}, context: ${context})`
				);

				switch (schema[prop].type) {
					case 'string':
						assert.strictEqual(
							typeof response[prop],
							'string',
							`"${prop}" was expected to be a string, but was ${typeof response[
							prop
							]} instead (path: ${method} ${path}, context: ${context})`
						);
						break;
					case 'boolean':
						assert.strictEqual(
							typeof response[prop],
							'boolean',
							`"${prop}" was expected to be a boolean, but was ${typeof response[
							prop
							]} instead (path: ${method} ${path}, context: ${context})`
						);
						break;
					case 'object':
						assert.strictEqual(
							typeof response[prop],
							'object',
							`"${prop}" was expected to be an object, but was ${typeof response[
							prop
							]} instead (path: ${method} ${path}, context: ${context})`
						);
						compare(
							schema[prop],
							response[prop],
							method,
							path,
							context ? [context, prop].join('.') : prop
						);
						break;
					case 'array':
						assert.strictEqual(
							Array.isArray(response[prop]),
							true,
							`"${prop}" was expected to be an array, but was ${typeof response[
							prop
							]} instead (path: ${method} ${path}, context: ${context})`
						);

						if (schema[prop].items) {
							assert(
								schema[prop].items.type ||
								schema[prop].items.allOf ||
								schema[prop].items.anyOf ||
								schema[prop].items.oneOf,
								`"${prop}" is defined to be an array, but its items have no schema defined (path: ${method} ${path}, context: ${context})`
							);

							if (
								schema[prop].items.type === 'object' ||
								Array.isArray(
									schema[prop].items.allOf ||
									schema[prop].items.anyOf ||
									schema[prop].items.oneOf
								)
							) {
								response[prop].forEach((res) => {
									compare(
										schema[prop].items,
										res,
										method,
										path,
										context ? [context, prop].join('.') : prop
									);
								});
							} else if (response[prop].length) {
								response[prop].forEach((item) => {
									assert.strictEqual(
										typeof item,
										schema[prop].items.type,
										`"${prop}" should have ${schema[prop].items.type
										} items, but found ${typeof items} instead (path: ${method} ${path}, context: ${context})`
									);
								});
							}
						}
						break;
				}
			}
		});

		Object.keys(response).forEach((prop) => {
			if (additionalProperties) {
				return;
			}

			assert(
				schema[prop],
				`"${prop}" was found in response, but is not defined in schema (path: ${method} ${path}, context: ${context})`
			);
		});
	}
});
'use strict';

const assert = require('assert');
const nconf = require('nconf');
const path = require('path');

const db = require('./mocks/databasemock');
const slugify = require('../src/slugify');
const utils = require('../src/utils');
const request = require('../src/request');

const file = require('../src/file');
const install = require('../src/install');
const meta = require('../src/meta');
const user = require('../src/user');
const categories = require('../src/categories');
const topics = require('../src/topics');
const posts = require('../src/posts');
const activitypub = require('../src/activitypub');

describe('ActivityPub integration', () => {
	before(async () => {
		meta.config.activitypubEnabled = 1;
		meta.config.activitypubAllowLoopback = 1;
		await install.giveWorldPrivileges();
	});

	after(() => {
		delete meta.config.activitypubEnabled;
	});

	describe('Outgoing AP logging for test runner', () => {
		it('should log an entry in ActivityPub._sent when .send is called', async () => {
			const uuid = utils.generateUUID();
			const uid = await user.create({ username: uuid });
			await activitypub.send('uid', 0, [`https://localhost/uid/${uid}`], { id: `${nconf.get('url')}/activity/${uuid}`, foo: 'bar' });

			assert(activitypub._sent.has(`${nconf.get('url')}/activity/${uuid}`));
		});
	});

	describe('Master toggle', () => {
		before(async () => {
			delete meta.config.activitypubEnabled;
		});

		it('calls to activitypub.get should throw', async () => {
			await assert.rejects(
				activitypub.get('uid', 0, 'https://example.org'),
				{ message: '[[error:activitypub.not-enabled]]' },
			);
		});

		it('calls to activitypub.send should silently log', async () => {
			await activitypub.send('uid', 0, ['https://example.org'], { foo: 'bar' });
			assert.strictEqual(activitypub.helpers.log(), '[activitypub/send] Federation not enabled; not sending.');
		});

		it('request for an activitypub route should return 404 Not Found', async () => {
			const uid = user.create({ username: utils.generateUUID() });
			const { response } = await request.get(`${nconf.get('url')}/uid/${uid}`, {
				headers: {
					Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				},
			});

			assert.strictEqual(response.statusCode, 404);
		});

		it('requests to the /ap endpoint should return 404 Not Found', async () => {
			const { response } = await request.get(`${nconf.get('url')}/ap?resource=${encodeURIComponent('https://example.org')}`);
			assert.strictEqual(response.statusCode, 404);
		});

		it('webfinger request to a local user should not indicate an application/activity+json endpoint', async () => {
			const username = utils.generateUUID().slice(0, 8);
			await user.create({ username });
			const { response, body } = await request.get(`${nconf.get('url')}/.well-known/webfinger?resource=acct%3a${username}%40${nconf.get('url_parsed').host}`);

			assert.strictEqual(response.statusCode, 200);
			assert(body && body.links && Array.isArray(body.links));
			assert(!body.links.some(obj => obj.type && obj.type === 'application/activity+json'));
		});

		after(() => {
			meta.config.activitypubEnabled = 1;
		});
	});

	describe('Helpers', () => {
		describe('.query()', () => {

		});

		describe('.generateKeys()', () => {

		});

		describe('.resolveId()', () => {
			let url;
			let resolved;

			before(() => {
				url = 'https://example.org/topic/foobar';
				resolved = 'https://example.org/tid/1234';
				activitypub._cache.set(`0;${url}`, {
					id: resolved,
				});
			});

			it('should return the resolved id when queried', async () => {
				const id = await activitypub.resolveId(0, url);
				assert.strictEqual(id, resolved);
			});

			it('should return null when the query fails', async () => {
				const id = await activitypub.resolveId(0, 'https://example.org/sdlknsdfnsd');
				assert.strictEqual(id, null);
			});

			it('should return null when the resolved host does not match the queried host', async () => {
				const url = 'https://example.com/topic/foobar'; // .com attempting to overwrite .org data
				const resolved = 'https://example.org/tid/1234'; // .org
				activitypub._cache.set(`0;${url}`, {
					id: resolved,
				});

				const id = await activitypub.resolveId(0, url);
				assert.strictEqual(id, null);
			});
		});

		describe('.resolveLocalId()', () => {
			let uid;
			let slug;

			beforeEach(async () => {
				slug = slugify(utils.generateUUID().slice(0, 8));
				uid = await user.create({ username: slug });
			});

			it('should return null when an invalid input is passed in', async () => {
				const { type, id } = await activitypub.helpers.resolveLocalId('ncl28h3qwhoiclwnevoinw3u');
				assert.strictEqual(type, null);
				assert.strictEqual(id, null);
			});

			it('should return null when valid input is passed but does not resolve', async () => {
				const { type, id } = await activitypub.helpers.resolveLocalId(`acct%3afoobar@${nconf.get('url_parsed').host}`);
				assert.strictEqual(type, 'user');
				assert.strictEqual(id, null);
			});

			it('should resolve to a local uid when given a webfinger-style string', async () => {
				const { id } = await activitypub.helpers.resolveLocalId(`acct%3a${slug}@${nconf.get('url_parsed').host}`);
				assert.strictEqual(id, uid);
			});

			it('should resolve even without the "acct:" prefix', async () => {
				const { id } = await activitypub.helpers.resolveLocalId(`${slug}@${nconf.get('url_parsed').host}`);
				assert.strictEqual(id, uid);
			});

			it('should resolve when passed a full URL', async () => {
				const { id } = await activitypub.helpers.resolveLocalId(`${nconf.get('url')}/user/${slug}`);
				assert.strictEqual(id, uid);
			});
		});

		describe('.remoteAnchorToLocalProfile', () => {
			const uuid1 = utils.generateUUID();
			const id1 = `https://example.org/uuid/${uuid1}`;
			const url1 = `https://example.org/test`;
			const uuid2 = utils.generateUUID();
			const id2 = `https://example.org/uuid/${uuid2}`;
			const localUsername = utils.generateUUID();
			const localSlug = slugify(localUsername);
			let localUid;
			before(async () => {
				// Mock up a fake remote user
				[,,,, localUid] = await Promise.all([
					db.setObjectField('remoteUrl:uid', url1, id1),
					db.sortedSetAdd('usersRemote:lastCrawled', Date.now(), id2),
					db.setObject(`userRemote:${id1}`, { uid: id1, userslug: uuid1 }),
					db.setObject(`userRemote:${id2}`, { uid: id2, userslug: id2 }),
					user.create({ username: localUsername }),
				]);
			});

			it('should convert an anchor pointing to a remote user URL', async () => {
				const content = `adsf <a href="${url1}">@${uuid1}</a> asdf`;
				const converted = await activitypub.helpers.remoteAnchorToLocalProfile(content);
				assert.strictEqual(converted, `adsf <a href="/user/${uuid1}">@${uuid1}</a> asdf`);
			});

			it('should convert an anchor pointing to a remote user id', async () => {
				const content = `adsf <a href="${id2}">@${uuid2}</a> asdf`;
				const converted = await activitypub.helpers.remoteAnchorToLocalProfile(content);
				assert.strictEqual(converted, `adsf <a href="/user/${encodeURIComponent(id2)}">@${uuid2}</a> asdf`);
			});

			it('should convert an anchor pointing to a local user URL', async () => {
				const content = `adsf <a href="${nconf.get('url')}/user/${localSlug}">@${localSlug}</a> asdf`;
				const converted = await activitypub.helpers.remoteAnchorToLocalProfile(content);
				assert.strictEqual(converted, `adsf <a href="/user/${localSlug}">@${localSlug}</a> asdf`);
			});

			it('should convert an anchor pointing to a local user URL', async () => {
				const content = `adsf <a href="${nconf.get('url')}/uid/${localUid}">@${localSlug}</a> asdf`;
				const converted = await activitypub.helpers.remoteAnchorToLocalProfile(content);
				assert.strictEqual(converted, `adsf <a href="/user/${localSlug}">@${localSlug}</a> asdf`);
			});

			after(async () => {
				await Promise.all([
					db.deleteObjectField('remoteUrl:uid', url1),
					db.sortedSetRemove('usersRemote:lastCrawled', id2),
				]);
			});
		});
	});

	describe('ActivityPub screener middleware', () => {
		let uid;

		beforeEach(async () => {
			uid = await user.create({ username: slugify(utils.generateUUID().slice(0, 8)) });
		});

		it('should return regular user profile html if federation is disabled', async () => {
			delete meta.config.activitypubEnabled;

			const { response, body } = await request.get(`${nconf.get('url')}/uid/${uid}`, {
				headers: {
					Accept: 'text/html',
				},
			});

			assert(response);
			assert.strictEqual(response.statusCode, 200);
			assert(body.startsWith('<!DOCTYPE html>'));

			meta.config.activitypubEnabled = 1;
		});

		it('should return regular user profile html if Accept header is not ActivityPub-related', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/uid/${uid}`, {
				headers: {
					Accept: 'text/html',
				},
			});

			assert(response);
			assert.strictEqual(response.statusCode, 200);
			assert(body.startsWith('<!DOCTYPE html>'));
		});

		it('should return the ActivityPub Actor JSON-LD payload if the correct Accept header is provided', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/uid/${uid}`, {
				headers: {
					Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				},
			});

			assert(response);
			assert.strictEqual(response.statusCode, 200);
			assert(body.hasOwnProperty('@context'));
			assert(body['@context'].includes('https://www.w3.org/ns/activitystreams'));
		});
	});

	describe('Receipt of ActivityPub events to inboxes (federating IN)', () => {
		describe('Create', () => {
			describe('Note', () => {
				const slug = utils.generateUUID();
				const id = `https://example.org/status/${slug}`;
				const remoteNote = {
					'@context': 'https://www.w3.org/ns/activitystreams',
					id,
					url: id,
					type: 'Note',
					to: ['https://www.w3.org/ns/activitystreams#Public'],
					cc: ['https://example.org/user/foobar/followers'],
					inReplyTo: null,
					attributedTo: 'https://example.org/user/foobar',
					name: 'Foo Bar',
					content: '<b>Baz quux</b>',
					published: new Date().toISOString(),
					source: {
						content: '**Baz quux**',
						mediaType: 'text/markdown',
					},
				};
				const remoteUser = {
					'@context': 'https://www.w3.org/ns/activitystreams',
					id: 'https://example.org/user/foobar',
					url: 'https://example.org/user/foobar',

					type: 'Person',
					name: 'Foo Bar',
					preferredUsername: 'foobar',
					publicKey: {
						id: 'https://example.org/user/foobar#key',
						owner: 'https://example.org/user/foobar',
						publicKeyPem: 'publickey',
					},
				};

				let topic;

				before(async () => {
					const controllers = require('../src/controllers');

					activitypub._cache.set(`0;${id}`, remoteNote);
					activitypub._cache.set(`0;https://example.org/user/foobar`, remoteUser);
					await db.sortedSetAdd(`followersRemote:${remoteUser.id}`, Date.now(), 1); // fake a follow
					await controllers.activitypub.postInbox({
						body: {
							type: 'Create',
							actor: 'https://example.org/user/foobar',
							object: remoteNote,
						},
					}, { sendStatus: () => {} });
				});

				it('should create a new topic if Note is at root-level or its parent has not been seen before', async () => {
					const saved = await db.getObject(`post:${id}`);

					assert(saved);
					assert(saved.tid);

					topic = await topics.getTopicData(saved.tid);
					const { uid, mainPid } = topic;
					assert(uid && mainPid);
					const { content, sourceContent } = await posts.getPostData(mainPid);
					assert.strictEqual(uid, 'https://example.org/user/foobar');
					assert.strictEqual(content, '');
					assert.strictEqual(sourceContent, '**Baz quux**');
				});

				it('should properly save the topic title in the topic hash', async () => {
					assert.strictEqual(topic.title, 'Foo Bar');
				});

				it('should properly save the mainPid in the topic hash', async () => {
					assert.strictEqual(topic.mainPid, id);
				});

				// todo: test topic replies, too
			});
		});
	});

	describe('Serving of local assets to remote clients (mocking)', () => {
		describe('Note', () => {
			let cid;
			let uid;

			before(async () => {
				({ cid } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
				const slug = slugify(utils.generateUUID().slice(0, 8));
				uid = await user.create({ username: slug });
			});

			describe('Existing and resolvable', () => {
				let body;
				let response;
				let postData;

				before(async () => {
					({ postData } = await topics.post({
						uid,
						cid,
						title: 'Lorem "Lipsum" Ipsum',
						content: 'Lorem ipsum dolor sit amet',
					}));

					({ body, response } = await request.get(`${nconf.get('url')}/post/${postData.pid}`, {
						headers: {
							Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
						},
					}));
				});

				it('should return a 404 on a non-existant post', async () => {
					const { response } = await request.get(`${nconf.get('url')}/post/${parseInt(postData.pid, 10) + 1}`, {
						headers: {
							Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
						},
					});

					assert.strictEqual(response.statusCode, 404);
				});

				it('should return a 200 response on an existing post', () => {
					assert.strictEqual(response.statusCode, 200);
				});

				it('should return the expected Content-Type header', () => {
					assert.strictEqual(response.headers['content-type'], 'application/activity+json; charset=utf-8');
				});

				it('Topic title (`name`) should not be escaped', () => {
					assert.strictEqual(body.name, 'Lorem "Lipsum" Ipsum');
				});
			});

			describe('Soft deleted', () => {
				let body;
				let response;
				let postData;

				before(async () => {
					({ postData } = await topics.post({
						uid,
						cid,
						title: utils.generateUUID(),
						content: utils.generateUUID(),
					}));

					await posts.delete(postData.pid, uid);

					({ body, response } = await request.get(`${nconf.get('url')}/post/${postData.pid}`, {
						headers: {
							Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
						},
					}));
				});

				it('should return a 200 response on an existing post', () => {
					assert.strictEqual(response.statusCode, 200);
				});

				it('should return a Tombstone object', () => {
					assert.strictEqual(body.type, 'Tombstone');
				});

				it('should still retain the existing id and former type', () => {
					assert.strictEqual(body.id, `${nconf.get('url')}/post/${postData.pid}`);
					assert.strictEqual(body.formerType, 'Note');
				});

				it('should still contain contextual information (context, audience, attributedTo)', () => {
					assert(['context', 'audience', 'attributedTo'].every(prop => body.hasOwnProperty(prop) && body[prop]));
				});
			});
		});
	});

	describe('ActivityPub', async () => {
		let files;

		before(async () => {
			files = await file.walk(path.resolve(__dirname, './activitypub'));
		});

		it('subfolder tests', () => {
			files.forEach((filePath) => {
				require(filePath);
			});
		});
	});
});

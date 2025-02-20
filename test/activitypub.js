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
		await install.giveWorldPrivileges();
	});

	after(() => {
		delete meta.config.activitypubEnabled;
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

		describe('.generateTitle', () => {
			describe('test strings', () => {
				const cases = new Map([
					// first paragraph element
					['<p>test title</p><span>abc</span>', 'test title'],

					// other tags like h1 or span
					['<h1>Lorem ipsum dolor sit amet</h1><p>consectetur adipiscing elit. Integer tincidunt metus scelerisque, dignissim risus a, fermentum leo. Pellentesque eleifend ullamcorper risus tempus vestibulum. Proin mollis ipsum et magna lobortis, at pretium enim pharetra. Ut vel ex metus. Mauris faucibus lectus et nulla iaculis, et pellentesque elit pellentesque. Aliquam rhoncus nec nulla eu lacinia. Maecenas cursus iaculis ligula, eu pharetra ex suscipit sit amet.</p>', 'Lorem ipsum dolor sit amet'],
					['<span>Lorem ipsum dolor sit amet</span><p>consectetur adipiscing elit. Integer tincidunt metus scelerisque, dignissim risus a, fermentum leo. Pellentesque eleifend ullamcorper risus tempus vestibulum. Proin mollis ipsum et magna lobortis, at pretium enim pharetra. Ut vel ex metus. Mauris faucibus lectus et nulla iaculis, et pellentesque elit pellentesque. Aliquam rhoncus nec nulla eu lacinia. Maecenas cursus iaculis ligula, eu pharetra ex suscipit sit amet.</p>', 'Lorem ipsum dolor sit amet'],

					// first line's text otherwise
					['Lorem ipsum dolor sit amet\n\nconsectetur adipiscing elit. Integer tincidunt metus scelerisque, dignissim risus a, fermentum leo. Pellentesque eleifend ullamcorper risus tempus vestibulum. Proin mollis ipsum et magna lobortis, at pretium enim pharetra. Ut vel ex metus. Mauris faucibus lectus et nulla iaculis, et pellentesque elit pellentesque. Aliquam rhoncus nec nulla eu lacinia. Maecenas cursus iaculis ligula, eu pharetra ex suscipit sit amet.', 'Lorem ipsum dolor sit amet'],

					// first sentence of matched line/element
					['Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam a ex pellentesque, fringilla lorem non, blandit est. Nulla facilisi. Curabitur cursus neque vel enim semper, id lacinia elit facilisis. Vestibulum turpis orci, efficitur ut semper eu, faucibus eu turpis. Praesent eu odio non libero gravida tempor. Ut porta pellentesque orci. In porta nunc eget tincidunt interdum. Curabitur vel dui nec libero tempus porttitor. Phasellus tincidunt, diam id viverra suscipit, est diam maximus purus, in vestibulum dui ligula vel libero. Sed tempus finibus ante, sit amet consequat magna facilisis eget. Proin ullamcorper, velit sit amet feugiat varius, massa sem aliquam dui, non aliquam augue velit vel est. Phasellus eu sapien in purus feugiat scelerisque congue id velit. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos.', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'],

					// other sentence ending symbols
					['Lorem ipsum dolor sit amet, consectetur adipiscing elit? Etiam a ex pellentesque, fringilla lorem non, blandit est. Nulla facilisi. Curabitur cursus neque vel enim semper, id lacinia elit facilisis. Vestibulum turpis orci, efficitur ut semper eu, faucibus eu turpis. Praesent eu odio non libero gravida tempor. Ut porta pellentesque orci. In porta nunc eget tincidunt interdum. Curabitur vel dui nec libero tempus porttitor. Phasellus tincidunt, diam id viverra suscipit, est diam maximus purus, in vestibulum dui ligula vel libero. Sed tempus finibus ante, sit amet consequat magna facilisis eget. Proin ullamcorper, velit sit amet feugiat varius, massa sem aliquam dui, non aliquam augue velit vel est. Phasellus eu sapien in purus feugiat scelerisque congue id velit. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos.', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit?'],

					// Content after line breaks can be discarded
					['<p>Intro text<br /><a href="https://example.org/">example.org/</span></a></p><p>more text</p>', 'Intro text'],

					// HTML without outer wrapping element
					['Lorem ipsum dolor <span>sit amet</span>', 'Lorem ipsum dolor sit amet'],

					// Two sentences with punctuation
					['Lorem ipsum. Dolor sit amet.', 'Lorem ipsum.'],

					// Additional tests?
					// ['', ''],
				]);

				cases.forEach((value, key) => {
					it('should convert as expected', () => {
						const title = activitypub.helpers.generateTitle(key);
						assert.strictEqual(title, value);
					});
				});
			});

			it('should trim down the title if it is too long per settings', () => {
				const value = meta.config.maximumTitleLength;
				meta.config.maximumTitleLength = 10;
				const source = '@@@@@@@@@@@@@@@@@@@@';
				const title = activitypub.helpers.generateTitle(source);
				assert.strictEqual(title, '@@@@@@@...');
				meta.config.maximumTitleLength = value;
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

	describe('User Actor endpoint', () => {
		let uid;
		let slug;

		beforeEach(async () => {
			slug = slugify(utils.generateUUID().slice(0, 8));
			uid = await user.create({ username: slug });
		});

		it('should return a valid ActivityPub Actor JSON-LD payload', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/uid/${uid}`, {
				headers: {
					Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				},
			});

			assert(response);
			assert.strictEqual(response.statusCode, 200);
			assert(body.hasOwnProperty('@context'));
			assert(body['@context'].includes('https://www.w3.org/ns/activitystreams'));

			['id', 'url', 'followers', 'following', 'inbox', 'outbox'].forEach((prop) => {
				assert(body.hasOwnProperty(prop));
				assert(body[prop]);
			});

			assert.strictEqual(body.id, `${nconf.get('url')}/uid/${uid}`);
			assert.strictEqual(body.type, 'Person');
		});

		it('should contain a `publicKey` property with a public key', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/uid/${uid}`, {
				headers: {
					Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				},
			});

			assert(body.hasOwnProperty('publicKey'));
			assert(['id', 'owner', 'publicKeyPem'].every(prop => body.publicKey.hasOwnProperty(prop)));
		});
	});

	describe.only('Category Actor endpoint', () => {
		let cid;
		let slug;
		let description;

		beforeEach(async () => {
			slug = slugify(utils.generateUUID().slice(0, 8));
			description = utils.generateUUID();
			({ cid } = await categories.create({
				name: slug,
				description,
			}));
		});

		it('should return a valid ActivityPub Actor JSON-LD payload', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/category/${cid}`, {
				headers: {
					Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				},
			});

			assert(response);
			assert.strictEqual(response.statusCode, 200);
			assert(body.hasOwnProperty('@context'));
			assert(body['@context'].includes('https://www.w3.org/ns/activitystreams'));

			['id', 'url', /* 'followers', 'following', */ 'inbox', 'outbox'].forEach((prop) => {
				assert(body.hasOwnProperty(prop));
				assert(body[prop]);
			});

			assert.strictEqual(body.id, `${nconf.get('url')}/category/${cid}`);
			assert.strictEqual(body.type, 'Group');
			assert.strictEqual(body.summary, description);
			assert.deepStrictEqual(body.icon, {
				type: 'Image',
				mediaType: 'image/png',
				url: `${nconf.get('url')}/assets/uploads/category/category-${cid}-icon.png`,
			});
		});

		it('should contain a `publicKey` property with a public key', async () => {
			const { body } = await request.get(`${nconf.get('url')}/category/${cid}`, {
				headers: {
					Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				},
			});

			assert(body.hasOwnProperty('publicKey'));
			assert(['id', 'owner', 'publicKeyPem'].every(prop => body.publicKey.hasOwnProperty(prop)));
		});

		it('should serve the the backgroundImage in `icon` if set', async () => {
			const payload = {};
			payload[cid] = {
				backgroundImage: `/assets/uploads/files/test.png`,
			};
			await categories.update(payload);

			const { body } = await request.get(`${nconf.get('url')}/category/${cid}`, {
				headers: {
					Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				},
			});

			assert.deepStrictEqual(body.icon, {
				type: 'Image',
				mediaType: 'image/png',
				url: `${nconf.get('url')}/assets/uploads/files/test.png`,
			});
		});
	});

	describe('Instance Actor endpoint', () => {
		let response;
		let body;

		before(async () => {
			({ response, body } = await request.get(`${nconf.get('url')}/actor`, {
				headers: {
					Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				},
			}));
		});

		it('should respond properly', async () => {
			assert(response);
			assert.strictEqual(response.statusCode, 200);
		});

		it('should return a valid ActivityPub Actor JSON-LD payload', async () => {
			assert(body.hasOwnProperty('@context'));
			assert(body['@context'].includes('https://www.w3.org/ns/activitystreams'));

			['id', 'url', 'inbox', 'outbox', 'name', 'preferredUsername'].forEach((prop) => {
				assert(body.hasOwnProperty(prop));
				assert(body[prop]);
			});

			assert.strictEqual(body.id, body.url);
			assert.strictEqual(body.type, 'Application');
			assert.strictEqual(body.name, meta.config.site_title || 'NodeBB');
			assert.strictEqual(body.preferredUsername, nconf.get('url_parsed').hostname);
		});

		it('should contain a `publicKey` property with a public key', async () => {
			assert(body.hasOwnProperty('publicKey'));
			assert(['id', 'owner', 'publicKeyPem'].every(prop => body.publicKey.hasOwnProperty(prop)));
		});

		it('should also have a valid WebFinger response tied to `preferredUsername`', async () => {
			const { response, body: body2 } = await request.get(`${nconf.get('url')}/.well-known/webfinger?resource=acct%3a${body.preferredUsername}@${nconf.get('url_parsed').host}`);

			assert.strictEqual(response.statusCode, 200);
			assert(body2 && body2.aliases && body2.links);
			assert(body2.aliases.includes(nconf.get('url')));
			assert(body2.links.some(item => item.rel === 'self' && item.type === 'application/activity+json' && item.href === `${nconf.get('url')}/actor`));
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

	describe('Actor asserton', () => {
		describe('happy path', () => {
			let uid;
			let actorUri;

			before(async () => {
				uid = utils.generateUUID().slice(0, 8);
				actorUri = `https://example.org/user/${uid}`;
				activitypub._cache.set(`0;${actorUri}`, {
					'@context': 'https://www.w3.org/ns/activitystreams',
					id: actorUri,
					url: actorUri,

					type: 'Person',
					name: 'example',
					preferredUsername: 'example',
					inbox: `https://example.org/user/${uid}/inbox`,
					outbox: `https://example.org/user/${uid}/outbox`,

					publicKey: {
						id: `${actorUri}#key`,
						owner: actorUri,
						publicKeyPem: 'somekey',
					},
				});
			});

			it('should return true if successfully asserted', async () => {
				const result = await activitypub.actors.assert([actorUri]);
				assert(result && result.length);
			});

			it('should contain a representation of that remote user in the database', async () => {
				const exists = await db.exists(`userRemote:${actorUri}`);
				assert(exists);

				const userData = await user.getUserData(actorUri);
				assert(userData);
				assert.strictEqual(userData.uid, actorUri);
			});

			it('should save the actor\'s publicly accessible URL in the hash as well', async () => {
				const url = await user.getUserField(actorUri, 'url');
				assert.strictEqual(url, actorUri);
			});
		});

		describe('edge case: loopback handles and uris', () => {
			let uid;
			const userslug = utils.generateUUID().slice(0, 8);
			before(async () => {
				uid = await user.create({ username: userslug });
			});

			it('should return true but not actually assert the handle into the database', async () => {
				const handle = `${userslug}@${nconf.get('url_parsed').host}`;
				const result = await activitypub.actors.assert([handle]);
				assert(result);

				const handleExists = await db.isObjectField('handle:uid', handle);
				assert.strictEqual(handleExists, false);

				const userRemoteHashExists = await db.exists(`userRemote:${nconf.get('url')}/uid/${uid}`);
				assert.strictEqual(userRemoteHashExists, false);
			});

			it('should return true but not actually assert the uri into the database', async () => {
				const uri = `${nconf.get('url')}/uid/${uid}`;
				const result = await activitypub.actors.assert([uri]);
				assert(result);

				const userRemoteHashExists = await db.exists(`userRemote:${uri}`);
				assert.strictEqual(userRemoteHashExists, false);
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

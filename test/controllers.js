'use strict';

const assert = require('assert');
const nconf = require('nconf');
const fs = require('fs');
const path = require('path');
const util = require('util');

const request = require('../src/request');
const db = require('./mocks/databasemock');
const api = require('../src/api');
const categories = require('../src/categories');
const topics = require('../src/topics');
const posts = require('../src/posts');
const user = require('../src/user');
const groups = require('../src/groups');
const meta = require('../src/meta');
const translator = require('../src/translator');
const privileges = require('../src/privileges');
const plugins = require('../src/plugins');
const utils = require('../src/utils');
const slugify = require('../src/slugify');
const helpers = require('./helpers');

const sleep = util.promisify(setTimeout);

describe('Controllers', () => {
	let tid;
	let cid;
	let pid;
	let fooUid;
	let adminUid;
	let category;

	before(async () => {
		category = await categories.create({
			name: 'Test Category',
			description: 'Test category created by testing script',
		});
		cid = category.cid;

		fooUid = await user.create({ username: 'foo', password: 'barbar', gdpr_consent: true });
		await user.setUserField(fooUid, 'email', 'foo@test.com');
		await user.email.confirmByUid(fooUid);

		adminUid = await user.create({ username: 'admin', password: 'barbar', gdpr_consent: true });
		await groups.join('administrators', adminUid);

		const navigation = require('../src/navigation/admin');
		const data = require('../install/data/navigation.json');

		await navigation.save(data);

		const result = await topics.post({ uid: fooUid, title: 'test topic title', content: 'test topic content', cid: cid });
		tid = result.topicData.tid;

		pid = result.postData.pid;
	});

	it('should load /config with csrf_token', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/config`);
		assert.equal(response.statusCode, 200);
		assert(body.csrf_token);
	});

	it('should load /config with no csrf_token as spider', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/config`, {
			headers: {
				'user-agent': 'yandex',
			},
		});
		assert.equal(response.statusCode, 200);
		assert.strictEqual(body.csrf_token, false);
		assert.strictEqual(body.uid, -1);
		assert.strictEqual(body.loggedIn, false);
	});

	describe('homepage', () => {
		function hookMethod(hookData) {
			assert(hookData.req);
			assert(hookData.res);
			assert(hookData.next);

			hookData.res.render('mycustompage', {
				works: true,
			});
		}
		const message = utils.generateUUID();
		const name = 'mycustompage.tpl';
		const tplPath = path.join(nconf.get('views_dir'), name);

		before(async () => {
			plugins.hooks.register('myTestPlugin', {
				hook: 'action:homepage.get:mycustompage',
				method: hookMethod,
			});

			fs.writeFileSync(tplPath, message);
			await meta.templates.compileTemplate(name, message);
		});

		async function assertHomeUrl() {
			const { response, body } = await request.get(nconf.get('url'));
			assert.equal(response.statusCode, 200);
			assert(body);
		}

		it('should load default', async () => {
			await assertHomeUrl();
		});

		it('should load unread', async () => {
			await meta.configs.set('homePageRoute', 'unread');
			await assertHomeUrl();
		});

		it('should load recent', async () => {
			await meta.configs.set('homePageRoute', 'recent');
			await assertHomeUrl();
		});

		it('should load top', async () => {
			await meta.configs.set('homePageRoute', 'top');
			await assertHomeUrl();
		});

		it('should load popular', async () => {
			await meta.configs.set('homePageRoute', 'popular');
			await assertHomeUrl();
		});

		it('should load category', async () => {
			await meta.configs.set('homePageRoute', 'category/1/test-category');
			await assertHomeUrl();
		});

		it('should not load breadcrumbs on home page route', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api`);
			assert.equal(response.statusCode, 200);
			assert(body);
			assert(!body.breadcrumbs);
		});

		it('should redirect to custom', async () => {
			await meta.configs.set('homePageRoute', 'groups');
			await assertHomeUrl();
		});

		it('should 404 if custom does not exist', async () => {
			await meta.configs.set('homePageRoute', 'this-route-does-not-exist');
			const { response, body } = await request.get(nconf.get('url'));
			assert.equal(response.statusCode, 404);
			assert(body);
		});

		it('api should work with hook', async () => {
			await meta.configs.set('homePageRoute', 'mycustompage');
			const { response, body } = await request.get(`${nconf.get('url')}/api`);
			assert.equal(response.statusCode, 200);
			assert.equal(body.works, true);
			assert.equal(body.template.mycustompage, true);
		});

		it('should render with hook', async () => {
			await meta.configs.set('homePageRoute', 'mycustompage');
			const { response, body } = await request.get(nconf.get('url'));
			assert.equal(response.statusCode, 200);
			assert.ok(body);
			assert.ok(body.indexOf('<main id="panel"'));
			assert.ok(body.includes(message));
		});

		after(() => {
			plugins.hooks.unregister('myTestPlugin', 'action:homepage.get:custom', hookMethod);
			fs.unlinkSync(tplPath);
			fs.unlinkSync(tplPath.replace(/\.tpl$/, '.js'));
		});
	});

	describe('routes that should 200/404 etc.', () => {
		const baseUrl = nconf.get('url');
		const testRoutes = [
			{ it: 'should load /reset without code', url: '/reset' },
			{ it: 'should load /reset with invalid code', url: '/reset/123123' },
			{ it: 'should load /login', url: '/login' },
			{ it: 'should load /register', url: '/register' },
			{ it: 'should load /robots.txt', url: '/robots.txt' },
			{ it: 'should load /manifest.webmanifest', url: '/manifest.webmanifest' },
			{ it: 'should load /outgoing?url=<url>', url: '/outgoing?url=http://youtube.com' },
			{ it: 'should 404 on /outgoing with no url', url: '/outgoing', status: 404 },
			{ it: 'should 404 on /outgoing with javascript: protocol', url: '/outgoing?url=javascript:alert(1);', status: 404 },
			{ it: 'should 404 on /outgoing with invalid url', url: '/outgoing?url=derp', status: 404 },
			{ it: 'should load /sping', url: '/sping', body: 'healthy' },
			{ it: 'should load /ping', url: '/ping', body: '200' },
			{ it: 'should handle 404', url: '/arouteinthevoid', status: 404 },
			{ it: 'should load topic rss feed', url: `/topic/1.rss` },
			{ it: 'should load category rss feed', url: `/category/1.rss` },
			{ it: 'should load topics rss feed', url: `/topics.rss` },
			{ it: 'should load recent rss feed', url: `/recent.rss` },
			{ it: 'should load top rss feed', url: `/top.rss` },
			{ it: 'should load popular rss feed', url: `/popular.rss` },
			{ it: 'should load popular rss feed with term', url: `/popular/day.rss` },
			{ it: 'should load recent posts rss feed', url: `/recentposts.rss` },
			{ it: 'should load category recent posts rss feed', url: `/category/1/recentposts.rss` },
			{ it: 'should load user topics rss feed', url: `/user/foo/topics.rss` },
			{ it: 'should load tag rss feed', url: `/tags/nodebb.rss` },
			{ it: 'should load client.css', url: `/assets/client.css` },
			{ it: 'should load admin.css', url: `/assets/admin.css` },
			{ it: 'should load sitemap.xml', url: `/sitemap.xml` },
			{ it: 'should load sitemap/pages.xml', url: `/sitemap/pages.xml` },
			{ it: 'should load sitemap/categories.xml', url: `/sitemap/categories.xml` },
			{ it: 'should load sitemap/topics.1.xml', url: `/sitemap/topics.1.xml` },
			{ it: 'should load theme screenshot', url: `/css/previews/nodebb-theme-harmony` },
			{ it: 'should load users page', url: `/users` },
			{ it: 'should load users page section', url: `/users?section=online` },
			{ it: 'should load groups page', url: `/groups` },
			{ it: 'should get recent posts', url: `/api/recent/posts/month` },
			{ it: 'should get post data', url: `/api/v3/posts/1` },
			{ it: 'should get topic data', url: `/api/v3/topics/1` },
			{ it: 'should get category data', url: `/api/v3/categories/1` },
			{ it: 'should return osd data', url: `/osd.xml` },
			{ it: 'should load service worker', url: '/service-worker.js' },
		];
		testRoutes.forEach((route) => {
			it(route.it, async () => {
				const { response, body } = await request.get(`${baseUrl}/${route.url}`);
				assert.equal(response.statusCode, route.status || 200);
				if (route.body) {
					assert.strictEqual(String(body), route.body);
				} else {
					assert(body);
				}
			});
		});
	});

	it('should load /register/complete', async () => {
		const jar = request.jar();
		const csrf_token = await helpers.getCsrfToken(jar);
		const { response, body } = await request.post(`${nconf.get('url')}/register`, {
			body: {
				username: 'interstitial',
				password: '123456',
				'password-confirm': '123456',
				email: 'test@me.com',
			},
			jar,
			headers: {
				'x-csrf-token': csrf_token,
			},
		});
		assert.equal(response.statusCode, 200);
		assert.strictEqual(body.next, `${nconf.get('relative_path')}/register/complete`);

		const { response: res2, body: body2 } = await request.get(`${nconf.get('url')}/api/register/complete`, {
			jar: jar,
			json: true,
		});
		assert.equal(res2.statusCode, 200);
		assert(body2.sections);
		assert(body2.errors);
		assert(body2.title);
	});

	describe('registration interstitials', () => {
		describe('email update', () => {
			let jar;
			let token;
			const dummyEmailerHook = async (data) => {};

			before(async () => {
				// Attach an emailer hook so related requests do not error
				plugins.hooks.register('emailer-test', {
					hook: 'static:email.send',
					method: dummyEmailerHook,
				});

				jar = (await helpers.registerUser({
					username: utils.generateUUID().slice(0, 10),
					password: utils.generateUUID(),
				})).jar;
				token = await helpers.getCsrfToken(jar);

				meta.config.requireEmailAddress = 1;
			});

			after(() => {
				meta.config.requireEmailAddress = 0;
				plugins.hooks.unregister('emailer-test', 'static:email.send');
			});

			it('email interstitial should still apply if empty email entered and requireEmailAddress is enabled', async () => {
				const { response: res } = await request.post(`${nconf.get('url')}/register/complete`, {
					jar,
					maxRedirect: 0,
					redirect: 'manual',
					headers: {
						'x-csrf-token': token,
					},
					body: {
						email: '',
					},
				});

				assert.strictEqual(res.headers.location, `${nconf.get('relative_path')}/register/complete`);

				const { response, body } = await request.get(`${nconf.get('url')}/api/register/complete`, {
					jar,
				});
				assert.strictEqual(response.statusCode, 200);
				assert(body.errors.length);
				assert(body.errors.includes('[[error:invalid-email]]'));
			});

			it('gdpr interstitial should still apply if email requirement is disabled', async () => {
				meta.config.requireEmailAddress = 0;

				const { body } = await request.get(`${nconf.get('url')}/api/register/complete`, {
					jar,
				});

				assert(!body.errors.includes('[[error:invalid-email]]'));
				assert(!body.errors.includes('[[error:gdpr-consent-denied]]'));

				meta.config.requireEmailAddress = 1;
			});

			it('should error if userData is falsy', async () => {
				try {
					await user.interstitials.email({ userData: null });
					assert(false);
				} catch (err) {
					assert.strictEqual(err.message, '[[error:invalid-data]]');
				}
			});

			it('should throw error if email is not valid', async () => {
				const uid = await user.create({ username: 'interstiuser1' });
				const result = await user.interstitials.email({
					userData: { uid: uid, updateEmail: true },
					req: { uid: uid },
					interstitials: [],
				});
				assert.strictEqual(result.interstitials[0].template, 'partials/email_update');
				await assert.rejects(result.interstitials[0].callback({ uid }, {
					email: 'invalidEmail',
				}), { message: '[[error:invalid-email]]' });
			});

			it('should reject an email that comprises only whitespace', async () => {
				const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
				const result = await user.interstitials.email({
					userData: { uid: uid, updateEmail: true },
					req: { uid: uid },
					interstitials: [],
				});
				assert.strictEqual(result.interstitials[0].template, 'partials/email_update');
				await assert.rejects(result.interstitials[0].callback({ uid }, {
					email: '    ',
				}), { message: '[[error:invalid-email]]' });
			});

			it('should set req.session.emailChanged to 1', async () => {
				const uid = await user.create({ username: 'interstiuser2' });
				const result = await user.interstitials.email({
					userData: { uid: uid, updateEmail: true },
					req: { uid: uid, session: {} },
					interstitials: [],
				});

				await result.interstitials[0].callback({ uid: uid }, {
					email: 'interstiuser2@nodebb.org',
				});
				assert.strictEqual(result.req.session.emailChanged, 1);
			});

			it('should throw error if user tries to edit other users email', async () => {
				const uid = await user.create({ username: 'interstiuser4' });
				try {
					const result = await user.interstitials.email({
						userData: { uid: uid, updateEmail: true },
						req: { uid: 1000 },
						interstitials: [],
					});

					await result.interstitials[0].callback({ uid: uid }, {
						email: 'derp@derp.com',
					});
					assert(false);
				} catch (err) {
					assert.strictEqual(err.message, '[[error:no-privileges]]');
				}
			});

			it('should remove current email (only allowed if email not required)', async () => {
				meta.config.requireEmailAddress = 0;

				const uid = await user.create({ username: 'interstiuser5' });
				await user.setUserField(uid, 'email', 'interstiuser5@nodebb.org');
				await user.email.confirmByUid(uid);

				const result = await user.interstitials.email({
					userData: { uid: uid, updateEmail: true },
					req: { uid: uid, session: { id: 0 } },
					interstitials: [],
				});

				await result.interstitials[0].callback({ uid: uid }, {
					email: '',
				});
				const userData = await user.getUserData(uid);
				assert.strictEqual(userData.email, '');
				assert.strictEqual(userData['email:confirmed'], 0);

				meta.config.requireEmailAddress = 1;
			});

			it('should require a password (if one is set) for email change', async () => {
				try {
					const [username, password] = [utils.generateUUID().slice(0, 10), utils.generateUUID()];
					const uid = await user.create({ username, password });
					await user.setUserField(uid, 'email', `${username}@nodebb.org`);
					await user.email.confirmByUid(uid);

					const result = await user.interstitials.email({
						userData: { uid: uid, updateEmail: true },
						req: { uid: uid, session: { id: 0 } },
						interstitials: [],
					});

					await result.interstitials[0].callback({ uid: uid }, {
						email: `${username}@nodebb.com`,
					});
				} catch (err) {
					assert.strictEqual(err.message, '[[error:invalid-password]]');
				}
			});

			it('should require a password (if one is set) for email clearing', async () => {
				meta.config.requireEmailAddress = 0;

				try {
					const [username, password] = [utils.generateUUID().slice(0, 10), utils.generateUUID()];
					const uid = await user.create({ username, password });
					await user.setUserField(uid, 'email', `${username}@nodebb.org`);
					await user.email.confirmByUid(uid);

					const result = await user.interstitials.email({
						userData: { uid: uid, updateEmail: true },
						req: { uid: uid, session: { id: 0 } },
						interstitials: [],
					});

					await result.interstitials[0].callback({ uid: uid }, {
						email: '',
					});
				} catch (err) {
					assert.strictEqual(err.message, '[[error:invalid-password]]');
				}

				meta.config.requireEmailAddress = 1;
			});

			it('should successfully issue validation request if the correct password is passed in', async () => {
				const [username, password] = [utils.generateUUID().slice(0, 10), utils.generateUUID()];
				const uid = await user.create({ username, password });
				await user.setUserField(uid, 'email', `${username}@nodebb.org`);
				await user.email.confirmByUid(uid);

				const result = await user.interstitials.email({
					userData: { uid: uid, updateEmail: true },
					req: { uid: uid, session: { id: 0 } },
					interstitials: [],
				});

				await result.interstitials[0].callback({ uid }, {
					email: `${username}@nodebb.com`,
					password,
				});

				const pending = await user.email.isValidationPending(uid, `${username}@nodebb.com`);
				assert.strictEqual(pending, true);
				await user.setUserField(uid, 'email', `${username}@nodebb.com`);
				await user.email.confirmByUid(uid);
				const userData = await user.getUserData(uid);
				assert.strictEqual(userData.email, `${username}@nodebb.com`);
				assert.strictEqual(userData['email:confirmed'], 1);
			});

			describe('blocking access for unconfirmed emails', () => {
				let jar;
				let token;
				const username = utils.generateUUID().slice(0, 10);

				before(async () => {
					jar = (await helpers.registerUser({
						username,
						password: utils.generateUUID(),
					})).jar;
					token = await helpers.getCsrfToken(jar);
				});

				async function abortInterstitial() {
					await request.post(`${nconf.get('url')}/register/abort`, {
						jar,
						headers: {
							'x-csrf-token': token,
						},
					});
				}

				it('should not apply if requireEmailAddress is not enabled', async () => {
					meta.config.requireEmailAddress = 0;

					const { response } = await request.post(`${nconf.get('url')}/register/complete`, {
						jar,
						maxRedirect: 0,
						redirect: 'manual',
						headers: {
							'x-csrf-token': token,
						},
						body: {
							email: `${utils.generateUUID().slice(0, 10)}@example.org`,
							gdpr_agree_data: 'on',
							gdpr_agree_email: 'on',
						},
					});


					assert.strictEqual(response.headers.location, `${nconf.get('relative_path')}/`);
					meta.config.requireEmailAddress = 1;
				});

				it('should allow access to regular resources after an email is entered, even if unconfirmed', async () => {
					const { response } = await request.get(`${nconf.get('url')}/recent`, {
						jar,
						maxRedirect: 0,
					});

					assert.strictEqual(response.statusCode, 200);
				});

				it('should redirect back to interstitial for categories requiring validated email', async () => {
					const name = utils.generateUUID();
					const { cid } = await categories.create({ name });
					await privileges.categories.rescind(['groups:read'], cid, ['registered-users']);
					await privileges.categories.give(['groups:read'], cid, ['verified-users']);
					const { response } = await request.get(`${nconf.get('url')}/category/${cid}/${slugify(name)}`, {
						jar,
						maxRedirect: 0,
						redirect: 'manual',
					});

					assert.strictEqual(response.statusCode, 307);
					assert.strictEqual(response.headers.location, `${nconf.get('relative_path')}/register/complete`);
					await abortInterstitial();
				});

				it('should redirect back to interstitial for topics requiring validated email', async () => {
					const name = utils.generateUUID();
					const { cid } = await categories.create({ name });
					await privileges.categories.rescind(['groups:topics:read'], cid, 'registered-users');
					await privileges.categories.give(['groups:topics:read'], cid, 'verified-users');
					const { response } = await request.get(`${nconf.get('url')}/category/${cid}/${slugify(name)}`, {
						jar,
						maxRedirect: 0,
						redirect: 'manual',
					});

					assert.strictEqual(response.statusCode, 200);

					const title = utils.generateUUID();
					const uid = await user.getUidByUsername(username);
					const { topicData } = await topics.post({ uid, cid, title, content: utils.generateUUID() });
					const { response: res2 } = await request.get(`${nconf.get('url')}/topic/${topicData.tid}/${slugify(title)}`, {
						jar,
						maxRedirect: 0,
						redirect: 'manual',
					});
					assert.strictEqual(res2.statusCode, 307);
					assert.strictEqual(res2.headers.location, `${nconf.get('relative_path')}/register/complete`);
					await abortInterstitial();
					await topics.purge(topicData.tid, uid);
				});
			});
		});

		describe('gdpr', () => {
			let jar;
			let token;

			before(async () => {
				jar = (await helpers.registerUser({
					username: utils.generateUUID().slice(0, 10),
					password: utils.generateUUID(),
				})).jar;
				token = await helpers.getCsrfToken(jar);
			});

			it('registration should succeed once gdpr prompts are agreed to', async () => {
				const { response } = await request.post(`${nconf.get('url')}/register/complete`, {
					jar,
					maxRedirect: 0,
					redirect: 'manual',
					headers: {
						'x-csrf-token': token,
					},
					body: {
						gdpr_agree_data: 'on',
						gdpr_agree_email: 'on',
					},
				});

				assert.strictEqual(response.statusCode, 302);
				assert.strictEqual(response.headers.location, `${nconf.get('relative_path')}/`);
			});
		});

		describe('abort behaviour', () => {
			let jar;
			let token;

			beforeEach(async () => {
				jar = (await helpers.registerUser({
					username: utils.generateUUID().slice(0, 10),
					password: utils.generateUUID(),
				})).jar;
				token = await helpers.getCsrfToken(jar);
			});

			it('should terminate the session and send user back to index if interstitials remain', async () => {
				const { response } = await request.post(`${nconf.get('url')}/register/abort`, {
					jar,
					maxRedirect: 0,
					redirect: 'manual',
					headers: {
						'x-csrf-token': token,
					},
				});

				assert.strictEqual(response.statusCode, 302);
				assert.strictEqual(response.headers['set-cookie'], `express.sid=; Path=${nconf.get('relative_path') || '/'}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`);
				assert.strictEqual(response.headers.location, `${nconf.get('relative_path')}/`);
			});

			it('should preserve the session and send user back to user profile if no interstitials remain (e.g. GDPR OK + email change cancellation)', async () => {
				// Submit GDPR consent
				await request.post(`${nconf.get('url')}/register/complete`, {
					jar,
					maxRedirect: 0,
					redirect: 'manual',
					headers: {
						'x-csrf-token': token,
					},
					body: {
						gdpr_agree_data: 'on',
						gdpr_agree_email: 'on',
					},
				});

				// Start email change flow
				await request.get(`${nconf.get('url')}/me/edit/email`, { jar });

				const { response } = await request.post(`${nconf.get('url')}/register/abort`, {
					jar,
					maxRedirect: 0,
					redirect: 'manual',
					headers: {
						'x-csrf-token': token,
					},
				});

				assert.strictEqual(response.statusCode, 302);
				assert(response.headers.location.match(/\/uid\/\d+$/));
			});
		});
	});


	it('should load /tos', async () => {
		meta.config.termsOfUse = 'please accept our tos';
		const { response, body } = await request.get(`${nconf.get('url')}/tos`);
		assert.equal(response.statusCode, 200);
		assert(body);
	});


	it('should return 404 if meta.config.termsOfUse is empty', async () => {
		meta.config.termsOfUse = '';
		const { response, body } = await request.get(`${nconf.get('url')}/tos`);
		assert.equal(response.statusCode, 404);
		assert(body);
	});


	it('should error if guests do not have search privilege', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/users?query=bar&section=sort-posts`);
		assert.equal(response.statusCode, 500);
		assert(body);
		assert.equal(body.error, '[[error:no-privileges]]');
	});

	it('should load users search page', async () => {
		await privileges.global.give(['groups:search:users'], 'guests');
		const { response, body } = await request.get(`${nconf.get('url')}/users?query=bar&section=sort-posts`);
		assert.equal(response.statusCode, 200);
		assert(body);
		await privileges.global.rescind(['groups:search:users'], 'guests');
	});

	it('should load group details page', async () => {
		await groups.create({
			name: 'group-details',
			description: 'Foobar!',
			hidden: 0,
		});
		await groups.join('group-details', fooUid);

		await topics.post({
			uid: fooUid,
			title: 'topic title',
			content: 'test topic content',
			cid: cid,
		});

		const { response, body } = await request.get(`${nconf.get('url')}/api/groups/group-details`);
		assert.equal(response.statusCode, 200);
		assert(body);
		assert.equal(body.posts[0].content, 'test topic content');
	});

	it('should load group members page', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/groups/group-details/members`);
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should 404 when trying to load group members of hidden group', async () => {
		const groups = require('../src/groups');
		await groups.create({
			name: 'hidden-group',
			description: 'Foobar!',
			hidden: 1,
		});
		const { response } = await request.get(`${nconf.get('url')}/groups/hidden-group/members`);
		assert.equal(response.statusCode, 404);
	});



	describe('revoke session', () => {
		let uid;
		let jar;
		let csrf_token;

		before(async () => {
			uid = await user.create({ username: 'revokeme', password: 'barbar' });
			const login = await helpers.loginUser('revokeme', 'barbar');
			jar = login.jar;
			csrf_token = login.csrf_token;
		});

		it('should fail to revoke session with missing uuid', async () => {
			const { response } = await request.del(`${nconf.get('url')}/api/user/revokeme/session`, {
				jar: jar,
				headers: {
					'x-csrf-token': csrf_token,
				},
			});
			assert.equal(response.statusCode, 404);
		});

		it('should fail if user doesn\'t exist', async () => {
			const { response, body } = await request.del(`${nconf.get('url')}/api/v3/users/doesnotexist/sessions/1112233`, {
				jar: jar,
				headers: {
					'x-csrf-token': csrf_token,
				},
			});

			assert.strictEqual(response.statusCode, 404);
			// const parsedResponse = JSON.parse(body);
			assert.deepStrictEqual(body.response, {});
			assert.deepStrictEqual(body.status, {
				code: 'not-found',
				message: 'User does not exist',
			});
		});

		it('should revoke user session', async () => {
			const sids = await db.getSortedSetRange(`uid:${uid}:sessions`, 0, -1);
			const sid = sids[0];
			const sessionObj = await db.sessionStoreGet(sid);

			const { response, body } = await request.del(`${nconf.get('url')}/api/v3/users/${uid}/sessions/${sessionObj.meta.uuid}`, {
				jar: jar,
				headers: {
					'x-csrf-token': csrf_token,
				},
			});

			assert.strictEqual(response.statusCode, 200);
			assert.deepStrictEqual(body, {
				status: {
					code: 'ok',
					message: 'OK',
				},
				response: {},
			});
		});
	});

	describe('widgets', () => {
		const widgets = require('../src/widgets');

		before(async () => {
			await widgets.reset();
			const data = {
				template: 'categories.tpl',
				location: 'sidebar',
				widgets: [
					{
						widget: 'html',
						data: {
							html: 'test',
							title: '',
							container: '',
						},
					},
				],
			};

			await widgets.setArea(data);
		});

		it('should return {} if there are no widgets', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/category/${cid}`);
			assert.equal(response.statusCode, 200);
			assert(body.widgets);
			assert.equal(Object.keys(body.widgets).length, 0);
		});

		it('should render templates', async () => {
			const url = `${nconf.get('url')}/api/categories`;
			const { response, body } = await request.get(url);
			assert.equal(response.statusCode, 200);
			assert(body.widgets);
			assert(body.widgets.sidebar);
			assert.equal(body.widgets.sidebar[0].html, 'test');
		});

		it('should reset templates', async () => {
			await widgets.resetTemplates(['categories', 'category']);
			const { response, body } = await request.get(`${nconf.get('url')}/api/categories`);
			assert.equal(response.statusCode, 200);
			assert(body.widgets);
			assert.equal(Object.keys(body.widgets).length, 0);
		});
	});

	describe('tags', () => {
		before(async () => {
			await topics.post({
				uid: fooUid,
				title: 'topic title',
				content: 'test topic content',
				cid: cid,
				tags: ['nodebb', 'bug', 'test'],
			});
		});

		it('should render tags page', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/tags`);
			assert.equal(response.statusCode, 200);
			assert(body);
			assert(Array.isArray(body.tags));
		});

		it('should render tag page with no topics', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/tags/notag`);
			assert.equal(response.statusCode, 200);
			assert(body);
			assert(Array.isArray(body.topics));
			assert.equal(body.topics.length, 0);
		});

		it('should render tag page with 1 topic', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/tags/nodebb`);
			assert.equal(response.statusCode, 200);
			assert(body);
			assert(Array.isArray(body.topics));
			assert.equal(body.topics.length, 1);
		});
	});


	describe('maintenance mode', () => {
		before((done) => {
			meta.config.maintenanceMode = 1;
			done();
		});
		after((done) => {
			meta.config.maintenanceMode = 0;
			done();
		});

		it('should return 503 in maintenance mode', async () => {
			const { response } = await request.get(`${nconf.get('url')}/recent`);
			assert.equal(response.statusCode, 503);
		});

		it('should return 503 in maintenance mode', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/recent`);
			assert.equal(response.statusCode, 503);
			assert(body);
		});

		it('should return 200 in maintenance mode', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/login`);
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should return 200 if guests are allowed', async () => {
			const oldValue = meta.config.groupsExemptFromMaintenanceMode;
			meta.config.groupsExemptFromMaintenanceMode.push('guests');
			const { response, body } = await request.get(`${nconf.get('url')}/api/recent`);
			assert.strictEqual(response.statusCode, 200);
			assert(body);
			meta.config.groupsExemptFromMaintenanceMode = oldValue;
		});
	});

	describe('account pages', () => {
		let jar;
		let csrf_token;

		before(async () => {
			({ jar, csrf_token } = await helpers.loginUser('foo', 'barbar'));
		});

		it('should redirect to account page with logged in user', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/login`, { jar });
			assert.equal(response.statusCode, 200);
			assert.equal(response.headers['x-redirect'], '/user/foo');
			assert.equal(body, '/user/foo');
		});

		it('should 404 if uid is not a number', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/uid/test`, { jar });
			assert.equal(response.statusCode, 404);
		});

		it('should redirect to userslug', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/uid/${fooUid}`);
			assert.equal(response.statusCode, 200);
			assert.equal(response.headers['x-redirect'], '/user/foo');
			assert.equal(body, '/user/foo');
		});

		it('should redirect to userslug and keep query params', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/uid/${fooUid}/topics?foo=bar`);
			assert.equal(response.statusCode, 200);
			assert.equal(response.headers['x-redirect'], '/user/foo/topics?foo=bar');
			assert.equal(body, '/user/foo/topics?foo=bar');
		});

		it('should 404 if user does not exist', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/uid/123123`);
			assert.equal(response.statusCode, 404);
		});

		describe('/me/*', () => {
			it('should redirect to user profile', async () => {
				const { response, body } = await request.get(`${nconf.get('url')}/me`, { jar });
				assert.equal(response.statusCode, 200);
				assert(body.includes('"template":{"name":"account/profile","account/profile":true}'));
				assert(body.includes('"username":"foo"'));
			});

			it('api should redirect to /user/[userslug]/bookmarks', async () => {
				const { response, body } = await request.get(`${nconf.get('url')}/api/me/bookmarks`, { jar });
				assert.equal(response.statusCode, 200);
				assert.equal(response.headers['x-redirect'], '/user/foo/bookmarks');
				assert.equal(body, '/user/foo/bookmarks');
			});

			it('api should redirect to /user/[userslug]/edit/username', async () => {
				const { response, body } = await request.get(`${nconf.get('url')}/api/me/edit/username`, { jar });
				assert.equal(response.statusCode, 200);
				assert.equal(response.headers['x-redirect'], '/user/foo/edit/username');
				assert.equal(body, '/user/foo/edit/username');
			});

			it('should redirect to login if user is not logged in', async () => {
				const { response, body } = await request.get(`${nconf.get('url')}/me/bookmarks`);
				assert.equal(response.statusCode, 200);
				assert(body.includes('Login to your account'), body.slice(0, 500));
			});
		});

		it('should 401 if user is not logged in', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/admin`);
			assert.equal(response.statusCode, 401);
		});

		it('should 403 if user is not admin', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/admin`, { jar });
			assert.equal(response.statusCode, 403);
		});

		it('should load /user/foo/posts', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/posts`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should 401 if not logged in', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/admin`);
			assert.equal(response.statusCode, 401);
			assert(body);
		});

		it('should load /user/foo/bookmarks', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/bookmarks`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load /user/foo/upvoted', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/upvoted`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load /user/foo/downvoted', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/downvoted`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load /user/foo/best', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/best`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load /user/foo/controversial', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/controversial`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load /user/foo/watched', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/watched`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load /user/foo/ignored', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/ignored`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load /user/foo/topics', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/topics`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load /user/foo/blocks', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/blocks`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load /user/foo/consent', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/consent`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load /user/foo/sessions', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/sessions`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load /user/foo/categories', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/categories`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load /user/foo/tags', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/tags`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load /user/foo/uploads', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/uploads`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		describe('user data export routes', () => {
			before(async () => {
				const types = ['profile', 'uploads', 'posts'];
				await Promise.all(types.map(async (type) => {
					await api.users.generateExport({ uid: fooUid, ip: '127.0.0.1' }, { uid: fooUid, type });
				}));
				await sleep(10000);
			});

			it('should export users posts', async () => {
				const { response, body } = await request.get(`${nconf.get('url')}/api/v3/users/${fooUid}/exports/posts`, { jar: jar });
				assert.equal(response.statusCode, 200);
				assert(body);
			});

			it('should export users uploads', async () => {
				const { response, body } = await request.get(`${nconf.get('url')}/api/v3/users/${fooUid}/exports/uploads`, { jar: jar });
				assert.equal(response.statusCode, 200);
				assert(body);
			});

			it('should export users profile', async () => {
				const { response, body } = await request.get(`${nconf.get('url')}/api/v3/users/${fooUid}/exports/profile`, { jar: jar });
				assert.equal(response.statusCode, 200);
				assert(body);
			});
		});

		it('should load notifications page', async () => {
			const notifications = require('../src/notifications');
			const notifData = {
				bodyShort: '[[notifications:user-posted-to, test1, test2]]',
				bodyLong: 'some post content',
				pid: 1,
				path: `/post/${1}`,
				nid: `new_post:tid:${1}:pid:${1}:uid:${fooUid}`,
				tid: 1,
				from: fooUid,
				mergeId: `notifications:user-posted-to|${1}`,
				topicTitle: 'topic title',
			};
			const notification = await notifications.create(notifData);
			await notifications.push(notification, fooUid);
			await sleep(2500);
			const { response, body } = await request.get(`${nconf.get('url')}/api/notifications`, {
				jar,
			});
			assert.equal(response.statusCode, 200);
			assert(body);
			const notif = body.notifications[0];
			assert.equal(notif.bodyShort, '<strong>test1</strong> has posted a reply to: <strong>test2</strong>');
			assert.equal(notif.bodyLong, notifData.bodyLong);
			assert.equal(notif.pid, notifData.pid);
			assert.equal(notif.path, nconf.get('relative_path') + notifData.path);
			assert.equal(notif.nid, notifData.nid);
		});

		it('should 404 if user does not exist', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/email/doesnotexist`);
			assert.equal(response.statusCode, 404);
			assert(body);
		});

		it('should load user by uid', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/uid/${fooUid}`);
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load user by username', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/username/foo`);
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should NOT load user by email (by default)', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/user/email/foo@test.com`);

			assert.strictEqual(response.statusCode, 404);
		});

		it('should load user by email if user has elected to show their email', async () => {
			await user.setSetting(fooUid, 'showemail', 1);
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/email/foo@test.com`);
			assert.strictEqual(response.statusCode, 200);
			assert(body);
			await user.setSetting(fooUid, 'showemail', 0);
		});

		it('should return 401 if user does not have view:users privilege', async () => {
			await privileges.global.rescind(['groups:view:users'], 'guests');

			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo`);
			assert.equal(response.statusCode, 401);
			assert.deepEqual(body, {
				response: {},
				status: {
					code: 'not-authorised',
					message: 'A valid login session was not found. Please log in and try again.',
				},
			});
			await privileges.global.give(['groups:view:users'], 'guests');
		});

		it('should return false if user can not edit user', async () => {
			await user.create({ username: 'regularJoe', password: 'barbar' });
			const { jar } = await helpers.loginUser('regularJoe', 'barbar');
			let { response } = await request.get(`${nconf.get('url')}/api/user/foo/info`, { jar });
			assert.equal(response.statusCode, 403);
			({ response } = await request.get(`${nconf.get('url')}/api/user/foo/edit`, { jar }));
			assert.equal(response.statusCode, 403);
		});

		it('should load correct user', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/user/FOO`, { jar: jar });
			assert.equal(response.statusCode, 200);
		});

		it('should redirect', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/user/FOO`, { jar: jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should 404 if user does not exist', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/doesnotexist`, { jar });
			assert.equal(response.statusCode, 404);
		});

		it('should not increase profile view if you visit your own profile', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/user/foo`, { jar });
			assert.equal(response.statusCode, 200);
			await sleep(500);
			const viewcount = await user.getUserField(fooUid, 'profileviews');
			assert(viewcount === 0);
		});

		it('should not increase profile view if a guest visits a profile', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/user/foo`, {});
			assert.equal(response.statusCode, 200);
			await sleep(500);
			const viewcount = await user.getUserField(fooUid, 'profileviews');
			assert(viewcount === 0);
		});

		it('should increase profile view', async () => {
			const { jar } = await helpers.loginUser('regularJoe', 'barbar');
			const { response } = await request.get(`${nconf.get('url')}/api/user/foo`, {
				jar,
			});
			assert.equal(response.statusCode, 200);
			await sleep(500);
			const viewcount = await user.getUserField(fooUid, 'profileviews');
			assert(viewcount > 0);
		});

		it('should parse about me', async () => {
			await user.setUserFields(fooUid, { picture: '/path/to/picture', aboutme: 'hi i am a bot' });
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo`);
			assert.equal(response.statusCode, 200);
			assert.equal(body.aboutme, 'hi i am a bot');
			assert.equal(body.picture, '/path/to/picture');
		});

		it('should not return reputation if reputation is disabled', async () => {
			meta.config['reputation:disabled'] = 1;
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo`);
			meta.config['reputation:disabled'] = 0;
			assert.equal(response.statusCode, 200);
			assert(!body.hasOwnProperty('reputation'));
		});

		it('should only return posts that are not deleted', async () => {
			const { topicData } = await topics.post({ uid: fooUid, title: 'visible', content: 'some content', cid: cid });
			const { pid: pidToDelete } = await topics.reply({ uid: fooUid, content: '1st reply', tid: topicData.tid });
			await topics.reply({ uid: fooUid, content: '2nd reply', tid: topicData.tid });
			await posts.delete(pidToDelete, fooUid);

			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo`);
			assert.equal(response.statusCode, 200);
			const contents = body.posts.map(p => p.content);
			assert(!contents.includes('1st reply'));
		});

		it('should return selected group title', async () => {
			await groups.create({
				name: 'selectedGroup',
			});
			const uid = await user.create({ username: 'groupie' });
			await groups.join('selectedGroup', uid);

			const { response, body } = await request.get(`${nconf.get('url')}/api/user/groupie`);
			assert.equal(response.statusCode, 200);
			assert(Array.isArray(body.selectedGroup));
			assert.equal(body.selectedGroup[0].name, 'selectedGroup');
		});

		it('should 404 if user does not exist', async () => {
			await groups.join('administrators', fooUid);

			const { response } = await request.get(`${nconf.get('url')}/api/user/doesnotexist/edit`, { jar });
			assert.equal(response.statusCode, 404);
			await groups.leave('administrators', fooUid);
		});

		it('should render edit/password', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/user/foo/edit/password`, { jar });
			assert.equal(response.statusCode, 200);
		});

		it('should render edit/email', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/edit/email`, { jar });

			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(body, '/register/complete');

			await request.post(`${nconf.get('url')}/register/abort`, {
				jar,
				headers: {
					'x-csrf-token': csrf_token,
				},
			});
		});

		it('should render edit/username', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/user/foo/edit/username`, { jar });
			assert.equal(response.statusCode, 200);
		});
	});

	describe('account follow page', () => {
		const socketUser = require('../src/socket.io/user');
		const apiUser = require('../src/api/users');
		let uid;
		before(async () => {
			uid = await user.create({ username: 'follower' });
			await apiUser.follow({ uid: uid }, { uid: fooUid });
			const isFollowing = await socketUser.isFollowing({ uid: uid }, { uid: fooUid });
			assert(isFollowing);
		});

		it('should get followers page', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/followers`);
			assert.equal(response.statusCode, 200);
			assert.equal(body.users[0].username, 'follower');
		});

		it('should get following page', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/follower/following`);
			assert.equal(response.statusCode, 200);
			assert.equal(body.users[0].username, 'foo');
		});

		it('should return empty after unfollow', async () => {
			await apiUser.unfollow({ uid: uid }, { uid: fooUid });
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/foo/followers`);
			assert.equal(response.statusCode, 200);
			assert.equal(body.users.length, 0);
		});
	});

	describe('post redirect', () => {
		let jar;
		before(async () => {
			({ jar } = await helpers.loginUser('foo', 'barbar'));
		});

		it('should 404 for invalid pid', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/post/fail`);
			assert.equal(response.statusCode, 404);
		});

		it('should 403 if user does not have read privilege', async () => {
			await privileges.categories.rescind(['groups:topics:read'], category.cid, 'registered-users');
			const { response } = await request.get(`${nconf.get('url')}/api/post/${pid}`, { jar });
			assert.equal(response.statusCode, 403);
			await privileges.categories.give(['groups:topics:read'], category.cid, 'registered-users');
		});

		it('should return correct post path', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/post/${pid}`);
			assert.equal(response.statusCode, 200);
			assert.equal(response.headers['x-redirect'], '/topic/1/test-topic-title');
			assert.equal(body, '/topic/1/test-topic-title');
		});
	});

	describe('cookie consent', () => {
		it('should return relevant data in configs API route', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/config`);
			assert.equal(response.statusCode, 200);
			assert.ok(body.cookies);
			assert.equal(translator.escape('[[global:cookies.message]]'), body.cookies.message);
			assert.equal(translator.escape('[[global:cookies.accept]]'), body.cookies.dismiss);
			assert.equal(translator.escape('[[global:cookies.learn-more]]'), body.cookies.link);
		});

		it('response should be parseable when entries have apostrophes', async () => {
			await meta.configs.set('cookieConsentMessage', 'Julian\'s Message');
			const { response, body } = await request.get(`${nconf.get('url')}/api/config`);
			assert.equal(response.statusCode, 200);
			assert.equal('Julian&#x27;s Message', body.cookies.message);
		});
	});

	describe('handle errors', () => {
		const plugins = require('../src/plugins');
		after((done) => {
			plugins.loadedHooks['filter:router.page'] = undefined;
			done();
		});

		it('should handle topic malformed uri', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/topic/1/a%AFc`);
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should handle category malformed uri', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/category/1/a%AFc`);
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should handle malformed uri ', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/user/a%AFc`);
			assert(body);
			assert.equal(response.statusCode, 400);
		});

		it('should handle malformed uri in api', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/a%AFc`);
			assert.equal(response.statusCode, 400);
			assert.equal(body.error, '[[global:400.title]]');
		});

		it('should handle CSRF error', async () => {
			plugins.loadedHooks['filter:router.page'] = plugins.loadedHooks['filter:router.page'] || [];
			plugins.loadedHooks['filter:router.page'].push({
				method: function (req, res, next) {
					const err = new Error('csrf-error');
					err.code = 'EBADCSRFTOKEN';
					next(err);
				},
			});

			const { response } = await request.get(`${nconf.get('url')}/users`);
			plugins.loadedHooks['filter:router.page'] = [];
			assert.equal(response.statusCode, 403);
		});

		it('should handle black-list error', async () => {
			plugins.loadedHooks['filter:router.page'] = plugins.loadedHooks['filter:router.page'] || [];
			plugins.loadedHooks['filter:router.page'].push({
				method: function (req, res, next) {
					const err = new Error('blacklist error message');
					err.code = 'blacklisted-ip';
					next(err);
				},
			});
			const { response, body } = await request.get(`${nconf.get('url')}/users`);
			plugins.loadedHooks['filter:router.page'] = [];
			assert.equal(response.statusCode, 403);
			assert.equal(body, 'blacklist error message');
		});

		it('should handle page redirect through error', async () => {
			plugins.loadedHooks['filter:router.page'] = plugins.loadedHooks['filter:router.page'] || [];
			plugins.loadedHooks['filter:router.page'].push({
				method: function (req, res, next) {
					const err = new Error('redirect');
					err.status = 302;
					err.path = '/popular';
					plugins.loadedHooks['filter:router.page'] = [];
					next(err);
				},
			});
			const { response, body } = await request.get(`${nconf.get('url')}/users`);
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should handle api page redirect through error', async () => {
			plugins.loadedHooks['filter:router.page'] = plugins.loadedHooks['filter:router.page'] || [];
			plugins.loadedHooks['filter:router.page'].push({
				method: function (req, res, next) {
					const err = new Error('redirect');
					err.status = 308;
					err.path = '/api/popular';
					plugins.loadedHooks['filter:router.page'] = [];
					next(err);
				},
			});
			const { response, body } = await request.get(`${nconf.get('url')}/api/users`);
			assert.equal(response.statusCode, 200);
			assert.equal(response.headers['x-redirect'], '/api/popular');
			assert(body, '/api/popular');
		});

		it('should handle error page', async () => {
			plugins.loadedHooks['filter:router.page'] = plugins.loadedHooks['filter:router.page'] || [];
			plugins.loadedHooks['filter:router.page'].push({
				method: function (req, res, next) {
					const err = new Error('regular error');
					next(err);
				},
			});
			const { response, body } = await request.get(`${nconf.get('url')}/users`);
			plugins.loadedHooks['filter:router.page'] = [];
			assert.equal(response.statusCode, 500);
			assert(body);
		});
	});

	describe('category', () => {
		let jar;
		before(async () => {
			({ jar } = await helpers.loginUser('foo', 'barbar'));
		});

		it('should return 404 if cid is not a number', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/category/fail`);
			assert.equal(response.statusCode, 404);
		});

		it('should return 404 if topic index is not a number', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/category/${category.slug}/invalidtopicindex`);
			assert.equal(response.statusCode, 404);
		});

		it('should 404 if category does not exist', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/category/123123`);
			assert.equal(response.statusCode, 404);
		});

		it('should 404 if category is disabled', async () => {
			const category = await categories.create({ name: 'disabled' });
			await categories.setCategoryField(category.cid, 'disabled', 1);
			const { response } = await request.get(`${nconf.get('url')}/api/category/${category.slug}`);
			assert.equal(response.statusCode, 404);
		});

		it('should return 401 if not allowed to read', async () => {
			const category = await categories.create({ name: 'hidden' });
			await privileges.categories.rescind(['groups:read'], category.cid, 'guests');
			const { response } = await request.get(`${nconf.get('url')}/api/category/${category.slug}`);
			assert.equal(response.statusCode, 401);
			await privileges.categories.give(['groups:read'], category.cid, 'guests');
		});

		it('should redirect if topic index is negative', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/category/${category.slug}/-10`);
			assert.equal(response.statusCode, 200);
			assert.ok(response.headers['x-redirect']);
		});

		it('should 404 if page is not found', async () => {
			await user.setSetting(fooUid, 'usePagination', 1);
			const { response } = await request.get(`${nconf.get('url')}/api/category/${category.slug}?page=100`, { jar });
			assert.equal(response.statusCode, 404);
		});

		it('should load page 1 if req.query.page is not sent', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/category/${category.slug}`, { jar });
			assert.equal(response.statusCode, 200);
			assert.equal(body.pagination.currentPage, 1);
		});

		it('should sort topics by most posts', async () => {
			const category = await categories.create({ name: 'most-posts-category' });
			await topics.post({ uid: fooUid, cid: category.cid, title: 'topic 1', content: 'topic 1 OP' });
			const t2 = await topics.post({ uid: fooUid, cid: category.cid, title: 'topic 2', content: 'topic 2 OP' });
			await topics.reply({ uid: fooUid, content: 'topic 2 reply', tid: t2.topicData.tid });

			const { response, body } = await request.get(`${nconf.get('url')}/api/category/${category.slug}?sort=most_posts`, { jar });
			assert.equal(response.statusCode, 200);
			assert.equal(body.topics[0].title, 'topic 2');
			assert.equal(body.topics[0].postcount, 2);
			assert.equal(body.topics[1].postcount, 1);
		});

		it('should load a specific users topics from a category with tags', async () => {
			const category = await categories.create({ name: 'filtered-category' });
			await topics.post({ uid: fooUid, cid: category.cid, title: 'topic 1', content: 'topic 1 OP', tags: ['java', 'cpp'] });
			await topics.post({ uid: fooUid, cid: category.cid, title: 'topic 2', content: 'topic 2 OP', tags: ['node', 'javascript'] });
			await topics.post({ uid: fooUid, cid: category.cid, title: 'topic 3', content: 'topic 3 OP', tags: ['java', 'cpp', 'best'] });

			let { body } = await request.get(`${nconf.get('url')}/api/category/${category.slug}?tag=node&author=foo`, { jar });
			assert.equal(body.topics[0].title, 'topic 2');

			({ body } = await request.get(`${nconf.get('url')}/api/category/${category.slug}?tag[]=java&tag[]=cpp`, { jar }));
			assert.equal(body.topics[0].title, 'topic 3');
			assert.equal(body.topics[1].title, 'topic 1');
		});

		it('should redirect if category is a link', async () => {
			const category = await categories.create({ name: 'redirect', link: 'https://nodebb.org' });
			const { cid } = category;

			let result = await request.get(`${nconf.get('url')}/api/category/${category.slug}`, { jar });
			assert.equal(result.response.headers['x-redirect'], 'https://nodebb.org');
			assert.equal(result.body, 'https://nodebb.org');
			await categories.setCategoryField(cid, 'link', '/recent');

			result = await request.get(`${nconf.get('url')}/api/category/${category.slug}`, { jar });
			assert.equal(result.response.headers['x-redirect'], '/recent');
			assert.equal(result.body, '/recent');
		});

		it('should get recent topic replies from children categories', async () => {
			const parentCategory = await categories.create({ name: 'parent category', backgroundImage: 'path/to/some/image' });
			const childCategory1 = await categories.create({ name: 'child category 1', parentCid: category.cid });
			const childCategory2 = await categories.create({ name: 'child category 2', parentCid: parentCategory.cid });
			await topics.post({ uid: fooUid, cid: childCategory2.cid, title: 'topic 1', content: 'topic 1 OP' });

			const { body } = await request.get(`${nconf.get('url')}/api/category/${parentCategory.slug}`, { jar });
			assert.equal(body.children[0].posts[0].content, 'topic 1 OP');
		});

		it('should create 2 pages of topics', async () => {
			const category = await categories.create({ name: 'category with 2 pages' });
			for (let i = 0; i < 30; i++) {
				// eslint-disable-next-line no-await-in-loop
				await topics.post({ uid: fooUid, cid: category.cid, title: `topic title ${i}`, content: 'does not really matter' });
			}
			const userSettings = await user.getSettings(fooUid);

			const { body } = await request.get(`${nconf.get('url')}/api/category/${category.slug}`, { jar });
			assert.equal(body.topics.length, userSettings.topicsPerPage);
			assert.equal(body.pagination.pageCount, 2);
		});

		it('should load categories', async () => {
			const helpers = require('../src/controllers/helpers');
			const data = await helpers.getCategories('cid:0:children', 1, 'topics:read', 0);
			assert(data.categories.length > 0);
			assert.strictEqual(data.selectedCategory, null);
			assert.deepStrictEqual(data.selectedCids, []);
		});

		it('should load categories by states', async () => {
			const helpers = require('../src/controllers/helpers');
			const data = await helpers.getCategoriesByStates(1, 1, Object.values(categories.watchStates), 'topics:read');
			assert.deepStrictEqual(data.selectedCategory.cid, 1);
			assert.deepStrictEqual(data.selectedCids, [1]);
		});

		it('should load categories by states', async () => {
			const helpers = require('../src/controllers/helpers');
			const data = await helpers.getCategoriesByStates(1, 0, [categories.watchStates.ignoring], 'topics:read');
			assert(data.categories.length === 0);
			assert.deepStrictEqual(data.selectedCategory, null);
			assert.deepStrictEqual(data.selectedCids, []);
		});
	});

	describe('unread', () => {
		let jar;
		before(async () => {
			({ jar } = await helpers.loginUser('foo', 'barbar'));
		});

		it('should load unread page', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/unread`, { jar });
			assert.equal(response.statusCode, 200);
		});

		it('should 404 if filter is invalid', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/unread/doesnotexist`, { jar });
			assert.equal(response.statusCode, 404);
		});

		it('should return total unread count', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/unread/total?filter=new`, { jar });
			assert.equal(response.statusCode, 200);
			assert.equal(body, 0);
		});

		it('should redirect if page is out of bounds', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/unread?page=-1`, { jar });
			assert.equal(response.statusCode, 200);
			assert.equal(response.headers['x-redirect'], '/unread?page=1');
			assert.equal(body, '/unread?page=1');
		});
	});

	describe('admin middlewares', () => {
		it('should redirect to login', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/admin/advanced/database`);
			assert.equal(response.statusCode, 401);
		});

		it('should redirect to login', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/admin/advanced/database`);
			assert.equal(response.statusCode, 200);
			assert(body.includes('Login to your account'));
		});
	});

	describe('composer', () => {
		let csrf_token;
		let jar;

		before(async () => {
			const login = await helpers.loginUser('foo', 'barbar');
			jar = login.jar;
			csrf_token = login.csrf_token;
		});

		it('should load the composer route', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/compose?cid=${cid}`, {
				jar,
			});
			assert.equal(response.statusCode, 200);
			assert(body.title);
			assert(body.template);
			assert.equal(body.url, `${nconf.get('relative_path')}/compose`);
		});

		it('should load the composer route if disabled by plugin', async () => {
			function hookMethod(hookData, callback) {
				hookData.templateData.disabled = true;
				callback(null, hookData);
			}

			plugins.hooks.register('myTestPlugin', {
				hook: 'filter:composer.build',
				method: hookMethod,
			});

			const { response, body } = await request.get(`${nconf.get('url')}/api/compose?cid=${cid}`, {
				jar,
			});
			assert.equal(response.statusCode, 200);
			assert(body.title);
			assert.strictEqual(body.template.name, '');
			assert.strictEqual(body.url, `${nconf.get('relative_path')}/compose`);

			plugins.hooks.unregister('myTestPlugin', 'filter:composer.build', hookMethod);
		});

		it('should error with invalid data', async () => {
			let result = await request.post(`${nconf.get('url')}/compose`, {
				data: {
					content: 'a new reply',
				},
				jar: jar,
				headers: {
					'x-csrf-token': csrf_token,
				},
			});

			assert.equal(result.response.statusCode, 400);
			result = await request.post(`${nconf.get('url')}/compose`, {
				body: {
					tid: tid,
				},
				jar: jar,
				headers: {
					'x-csrf-token': csrf_token,
				},
			});
			assert.equal(result.response.statusCode, 400);
		});

		it('should create a new topic and reply by composer route', async () => {
			let result = await request.post(`${nconf.get('url')}/compose`, {
				body: {
					cid: cid,
					title: 'no js is good',
					content: 'a topic with noscript',
				},
				jar: jar,
				maxRedirect: 0,
				redirect: 'manual',
				headers: {
					'x-csrf-token': csrf_token,
				},
			});

			assert.equal(result.response.statusCode, 302);
			result = await request.post(`${nconf.get('url')}/compose`, {
				body: {
					tid: tid,
					content: 'a new reply',
				},
				jar: jar,
				maxRedirect: 0,
				redirect: 'manual',
				headers: {
					'x-csrf-token': csrf_token,
				},
			});
			assert.equal(result.response.statusCode, 302);
		});

		it('should create a new topic and reply by composer route as a guest', async () => {
			const jar = request.jar();
			const csrf_token = await helpers.getCsrfToken(jar);

			await privileges.categories.give(['groups:topics:create', 'groups:topics:reply'], cid, 'guests');

			const result = await helpers.request('post', `/compose`, {
				body: {
					cid: cid,
					title: 'no js is good',
					content: 'a topic with noscript',
					handle: 'guest1',
				},
				jar,
				maxRedirect: 0,
				redirect: 'manual',
				headers: {
					'x-csrf-token': csrf_token,
				},
			});
			assert.strictEqual(result.response.statusCode, 302);

			const replyResult = await helpers.request('post', `/compose`, {
				body: {
					tid: tid,
					content: 'a new reply',
					handle: 'guest2',
				},
				jar,
				maxRedirect: 0,
				redirect: 'manual',
				headers: {
					'x-csrf-token': csrf_token,
				},
			});
			assert.equal(replyResult.response.statusCode, 302);
			await privileges.categories.rescind(['groups:topics:post', 'groups:topics:reply'], cid, 'guests');
		});

		it('should not load a topic data that is in private category', async () => {
			const { cid } = await categories.create({
				name: 'private',
				description: 'private',
			});

			const result = await topics.post({ uid: fooUid, title: 'hidden title', content: 'hidden content', cid: cid });

			await privileges.categories.rescind(['groups:topics:read'], category.cid, 'guests');
			let { response, body } = await request.get(`${nconf.get('url')}/api/compose?tid=${result.topicData.tid}`);
			assert.equal(response.statusCode, 401);
			assert(!body.title);

			({ response, body } = await request.get(`${nconf.get('url')}/api/compose?cid=${cid}`));
			assert.equal(response.statusCode, 401);
			assert(!body.title);

			({ response, body } = await request.get(`${nconf.get('url')}/api/compose?pid=${result.postData.pid}`));
			assert.equal(response.statusCode, 401);
			assert(!body.title);

			await privileges.categories.give(['groups:topics:read'], category.cid, 'guests');
		});
	});

	describe('test routes', () => {
		if (process.env.NODE_ENV === 'development') {
			it('should load debug route', async () => {
				const { response, body } = await request.get(`${nconf.get('url')}/debug/test`);
				assert.equal(response.statusCode, 404);
				assert(body);
			});

			it('should load redoc read route', async () => {
				const { response, body } = await request.get(`${nconf.get('url')}/debug/spec/read`);
				assert.equal(response.statusCode, 200);
				assert(body);
			});

			it('should load redoc write route', async () => {
				const { response, body } = await request.get(`${nconf.get('url')}/debug/spec/write`);
				assert.equal(response.statusCode, 200);
				assert(body);
			});

			it('should load 404 for invalid type', async () => {
				const { response, body } = await request.get(`${nconf.get('url')}/debug/spec/doesnotexist`);
				assert.equal(response.statusCode, 404);
				assert(body);
			});
		}
	});

	after((done) => {
		const analytics = require('../src/analytics');
		analytics.writeData(done);
	});
});

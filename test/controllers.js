'use strict';

const async = require('async');
const assert = require('assert');
const nconf = require('nconf');
const request = require('request');
const fs = require('fs');
const path = require('path');

const db = require('./mocks/databasemock');
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
const helpers = require('./helpers');

describe('Controllers', () => {
	let tid;
	let cid;
	let pid;
	let fooUid;
	let category;

	before((done) => {
		async.series({
			category: function (next) {
				categories.create({
					name: 'Test Category',
					description: 'Test category created by testing script',
				}, next);
			},
			user: function (next) {
				user.create({ username: 'foo', password: 'barbar', email: 'foo@test.com' }, next);
			},
			navigation: function (next) {
				const navigation = require('../src/navigation/admin');
				const data = require('../install/data/navigation.json');

				navigation.save(data, next);
			},
		}, (err, results) => {
			if (err) {
				return done(err);
			}
			category = results.category;
			cid = results.category.cid;
			fooUid = results.user;

			topics.post({ uid: results.user, title: 'test topic title', content: 'test topic content', cid: results.category.cid }, (err, result) => {
				tid = result.topicData.tid;
				pid = result.postData.pid;
				done(err);
			});
		});
	});

	it('should load /config with csrf_token', (done) => {
		request({
			url: `${nconf.get('url')}/api/config`,
			json: true,
		}, (err, response, body) => {
			assert.ifError(err);
			assert.equal(response.statusCode, 200);
			assert(body.csrf_token);
			done();
		});
	});

	it('should load /config with no csrf_token as spider', (done) => {
		request({
			url: `${nconf.get('url')}/api/config`,
			json: true,
			headers: {
				'user-agent': 'yandex',
			},
		}, (err, response, body) => {
			assert.ifError(err);
			assert.equal(response.statusCode, 200);
			assert.strictEqual(body.csrf_token, false);
			assert.strictEqual(body.uid, -1);
			assert.strictEqual(body.loggedIn, false);
			done();
		});
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

		it('should load default', (done) => {
			request(nconf.get('url'), (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load unread', (done) => {
			meta.configs.set('homePageRoute', 'unread', (err) => {
				assert.ifError(err);

				request(nconf.get('url'), (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body);
					done();
				});
			});
		});

		it('should load recent', (done) => {
			meta.configs.set('homePageRoute', 'recent', (err) => {
				assert.ifError(err);

				request(nconf.get('url'), (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body);
					done();
				});
			});
		});

		it('should load top', (done) => {
			meta.configs.set('homePageRoute', 'top', (err) => {
				assert.ifError(err);

				request(nconf.get('url'), (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body);
					done();
				});
			});
		});

		it('should load popular', (done) => {
			meta.configs.set('homePageRoute', 'popular', (err) => {
				assert.ifError(err);

				request(nconf.get('url'), (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body);
					done();
				});
			});
		});

		it('should load category', (done) => {
			meta.configs.set('homePageRoute', 'category/1/test-category', (err) => {
				assert.ifError(err);

				request(nconf.get('url'), (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body);
					done();
				});
			});
		});

		it('should not load breadcrumbs on home page route', (done) => {
			request(`${nconf.get('url')}/api`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				assert(!body.breadcrumbs);
				done();
			});
		});

		it('should redirect to custom', (done) => {
			meta.configs.set('homePageRoute', 'groups', (err) => {
				assert.ifError(err);

				request(nconf.get('url'), (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body);
					done();
				});
			});
		});

		it('should 404 if custom does not exist', (done) => {
			meta.configs.set('homePageRoute', 'this-route-does-not-exist', (err) => {
				assert.ifError(err);

				request(nconf.get('url'), (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 404);
					assert(body);
					done();
				});
			});
		});

		it('api should work with hook', (done) => {
			meta.configs.set('homePageRoute', 'mycustompage', (err) => {
				assert.ifError(err);

				request(`${nconf.get('url')}/api`, { json: true }, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert.equal(body.works, true);
					assert.equal(body.template.mycustompage, true);

					done();
				});
			});
		});

		it('should render with hook', (done) => {
			meta.configs.set('homePageRoute', 'mycustompage', (err) => {
				assert.ifError(err);

				request(nconf.get('url'), (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert.ok(body);
					assert.ok(body.indexOf('<main id="panel"'));
					assert.ok(body.includes(message));

					done();
				});
			});
		});

		after(() => {
			plugins.hooks.unregister('myTestPlugin', 'action:homepage.get:custom', hookMethod);
			fs.unlinkSync(tplPath);
			fs.unlinkSync(tplPath.replace(/\.tpl$/, '.js'));
		});
	});

	it('should load /reset without code', (done) => {
		request(`${nconf.get('url')}/reset`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /reset with invalid code', (done) => {
		request(`${nconf.get('url')}/reset/123123`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /login', (done) => {
		request(`${nconf.get('url')}/login`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /register', (done) => {
		request(`${nconf.get('url')}/register`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /register/complete', (done) => {
		function hookMethod(data, next) {
			data.interstitials.push({ template: 'topic.tpl', data: {} });
			next(null, data);
		}

		plugins.hooks.register('myTestPlugin', {
			hook: 'filter:register.interstitial',
			method: hookMethod,
		});

		const data = {
			username: 'interstitial',
			password: '123456',
			'password-confirm': '123456',
			email: 'test@me.com',
		};

		const jar = request.jar();
		request({
			url: `${nconf.get('url')}/api/config`,
			json: true,
			jar: jar,
		}, (err, response, body) => {
			assert.ifError(err);

			request.post(`${nconf.get('url')}/register`, {
				form: data,
				json: true,
				jar: jar,
				headers: {
					'x-csrf-token': body.csrf_token,
				},
			}, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.strictEqual(body.next, `${nconf.get('relative_path')}/register/complete`);
				request(`${nconf.get('url')}/api/register/complete`, {
					jar: jar,
					json: true,
				}, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body.sections);
					assert(body.errors);
					assert(body.title);
					plugins.hooks.unregister('myTestPlugin', 'filter:register.interstitial', hookMethod);
					done();
				});
			});
		});
	});

	it('should load /robots.txt', (done) => {
		request(`${nconf.get('url')}/robots.txt`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /manifest.webmanifest', (done) => {
		request(`${nconf.get('url')}/manifest.webmanifest`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /outgoing?url=<url>', (done) => {
		request(`${nconf.get('url')}/outgoing?url=http://youtube.com`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should 404 on /outgoing with no url', (done) => {
		request(`${nconf.get('url')}/outgoing`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			assert(body);
			done();
		});
	});

	it('should 404 on /outgoing with javascript: protocol', (done) => {
		request(`${nconf.get('url')}/outgoing?url=javascript:alert(1);`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			assert(body);
			done();
		});
	});

	it('should 404 on /outgoing with invalid url', (done) => {
		request(`${nconf.get('url')}/outgoing?url=derp`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			assert(body);
			done();
		});
	});

	it('should load /tos', (done) => {
		meta.config.termsOfUse = 'please accept our tos';
		request(`${nconf.get('url')}/tos`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});


	it('should load 404 if meta.config.termsOfUse is empty', (done) => {
		meta.config.termsOfUse = '';
		request(`${nconf.get('url')}/tos`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			assert(body);
			done();
		});
	});

	it('should load /sping', (done) => {
		request(`${nconf.get('url')}/sping`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert.equal(body, 'healthy');
			done();
		});
	});

	it('should load /ping', (done) => {
		request(`${nconf.get('url')}/ping`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert.equal(body, '200');
			done();
		});
	});

	it('should handle 404', (done) => {
		request(`${nconf.get('url')}/arouteinthevoid`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			assert(body);
			done();
		});
	});

	it('should load topic rss feed', (done) => {
		request(`${nconf.get('url')}/topic/${tid}.rss`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load category rss feed', (done) => {
		request(`${nconf.get('url')}/category/${cid}.rss`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load topics rss feed', (done) => {
		request(`${nconf.get('url')}/topics.rss`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load recent rss feed', (done) => {
		request(`${nconf.get('url')}/recent.rss`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load top rss feed', (done) => {
		request(`${nconf.get('url')}/top.rss`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load popular rss feed', (done) => {
		request(`${nconf.get('url')}/popular.rss`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load popular rss feed with term', (done) => {
		request(`${nconf.get('url')}/popular/day.rss`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load recent posts rss feed', (done) => {
		request(`${nconf.get('url')}/recentposts.rss`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load category recent posts rss feed', (done) => {
		request(`${nconf.get('url')}/category/${cid}/recentposts.rss`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load user topics rss feed', (done) => {
		request(`${nconf.get('url')}/user/foo/topics.rss`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load tag rss feed', (done) => {
		request(`${nconf.get('url')}/tags/nodebb.rss`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load client.css', (done) => {
		request(`${nconf.get('url')}/assets/client.css`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load admin.css', (done) => {
		request(`${nconf.get('url')}/assets/admin.css`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});


	it('should load nodebb.min.js', (done) => {
		request(`${nconf.get('url')}/assets/nodebb.min.js`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load acp.min.js', (done) => {
		request(`${nconf.get('url')}/assets/acp.min.js`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load sitemap.xml', (done) => {
		request(`${nconf.get('url')}/sitemap.xml`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load sitemap/pages.xml', (done) => {
		request(`${nconf.get('url')}/sitemap/pages.xml`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load sitemap/categories.xml', (done) => {
		request(`${nconf.get('url')}/sitemap/categories.xml`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load sitemap/topics/1.xml', (done) => {
		request(`${nconf.get('url')}/sitemap/topics.1.xml`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load robots.txt', (done) => {
		request(`${nconf.get('url')}/robots.txt`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load theme screenshot', (done) => {
		request(`${nconf.get('url')}/css/previews/nodebb-theme-persona`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load users page', (done) => {
		request(`${nconf.get('url')}/users`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load users page', (done) => {
		request(`${nconf.get('url')}/users?section=online`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should error if guests do not have search privilege', (done) => {
		request(`${nconf.get('url')}/api/users?query=bar&section=sort-posts`, { json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 500);
			assert(body);
			assert.equal(body.error, '[[error:no-privileges]]');
			done();
		});
	});

	it('should load users search page', (done) => {
		privileges.global.give(['groups:search:users'], 'guests', (err) => {
			assert.ifError(err);
			request(`${nconf.get('url')}/users?query=bar&section=sort-posts`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				privileges.global.rescind(['groups:search:users'], 'guests', done);
			});
		});
	});

	it('should load groups page', (done) => {
		request(`${nconf.get('url')}/groups`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load group details page', (done) => {
		groups.create({
			name: 'group-details',
			description: 'Foobar!',
			hidden: 0,
		}, (err) => {
			assert.ifError(err);
			groups.join('group-details', fooUid, (err) => {
				assert.ifError(err);
				topics.post({
					uid: fooUid,
					title: 'topic title',
					content: 'test topic content',
					cid: cid,
				}, (err) => {
					assert.ifError(err);
					request(`${nconf.get('url')}/api/groups/group-details`, { json: true }, (err, res, body) => {
						assert.ifError(err);
						assert.equal(res.statusCode, 200);
						assert(body);
						assert.equal(body.posts[0].content, 'test topic content');
						done();
					});
				});
			});
		});
	});

	it('should load group members page', (done) => {
		request(`${nconf.get('url')}/groups/group-details/members`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should 404 when trying to load group members of hidden group', (done) => {
		const groups = require('../src/groups');
		groups.create({
			name: 'hidden-group',
			description: 'Foobar!',
			hidden: 1,
		}, (err) => {
			assert.ifError(err);
			request(`${nconf.get('url')}/groups/hidden-group/members`, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});
	});

	it('should get recent posts', (done) => {
		request(`${nconf.get('url')}/api/recent/posts/month`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should get post data', (done) => {
		request(`${nconf.get('url')}/api/v3/posts/${pid}`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should get topic data', (done) => {
		request(`${nconf.get('url')}/api/v3/topics/${tid}`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should get category data', (done) => {
		request(`${nconf.get('url')}/api/v3/categories/${cid}`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});


	describe('revoke session', () => {
		let uid;
		let jar;
		let csrf_token;

		before((done) => {
			user.create({ username: 'revokeme', password: 'barbar' }, (err, _uid) => {
				assert.ifError(err);
				uid = _uid;
				helpers.loginUser('revokeme', 'barbar', (err, _jar, _csrf_token) => {
					assert.ifError(err);
					jar = _jar;
					csrf_token = _csrf_token;
					done();
				});
			});
		});

		it('should fail to revoke session with missing uuid', (done) => {
			request.del(`${nconf.get('url')}/api/user/revokeme/session`, {
				jar: jar,
				headers: {
					'x-csrf-token': csrf_token,
				},
			}, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should fail if user doesn\'t exist', (done) => {
			request.del(`${nconf.get('url')}/api/v3/users/doesnotexist/sessions/1112233`, {
				jar: jar,
				headers: {
					'x-csrf-token': csrf_token,
				},
			}, (err, res, body) => {
				assert.ifError(err);
				assert.strictEqual(res.statusCode, 404);
				const parsedResponse = JSON.parse(body);
				assert.deepStrictEqual(parsedResponse.response, {});
				assert.deepStrictEqual(parsedResponse.status, {
					code: 'not-found',
					message: '[[error:no-user]]',
				});
				done();
			});
		});

		it('should revoke user session', (done) => {
			db.getSortedSetRange(`uid:${uid}:sessions`, 0, -1, (err, sids) => {
				assert.ifError(err);
				const sid = sids[0];

				db.sessionStore.get(sid, (err, sessionObj) => {
					assert.ifError(err);
					request.del(`${nconf.get('url')}/api/v3/users/${uid}/sessions/${sessionObj.meta.uuid}`, {
						jar: jar,
						headers: {
							'x-csrf-token': csrf_token,
						},
					}, (err, res, body) => {
						assert.ifError(err);
						assert.strictEqual(res.statusCode, 200);
						assert.deepStrictEqual(JSON.parse(body), {
							status: {
								code: 'ok',
								message: 'OK',
							},
							response: {},
						});
						done();
					});
				});
			});
		});
	});

	describe('widgets', () => {
		const widgets = require('../src/widgets');

		before((done) => {
			async.waterfall([
				function (next) {
					widgets.reset(next);
				},
				function (next) {
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

					widgets.setArea(data, next);
				},
			], done);
		});

		it('should return {} if there are no widgets', (done) => {
			request(`${nconf.get('url')}/api/category/${cid}`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body.widgets);
				assert.equal(Object.keys(body.widgets).length, 0);
				done();
			});
		});

		it('should render templates', (done) => {
			const url = `${nconf.get('url')}/api/categories`;
			request(url, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body.widgets);
				assert(body.widgets.sidebar);
				assert.equal(body.widgets.sidebar[0].html, 'test');
				done();
			});
		});

		it('should reset templates', (done) => {
			widgets.resetTemplates(['categories', 'category'], (err) => {
				assert.ifError(err);
				request(`${nconf.get('url')}/api/categories`, { json: true }, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body.widgets);
					assert.equal(Object.keys(body.widgets).length, 0);
					done();
				});
			});
		});
	});

	describe('tags', () => {
		let tid;
		before((done) => {
			topics.post({
				uid: fooUid,
				title: 'topic title',
				content: 'test topic content',
				cid: cid,
				tags: ['nodebb', 'bug', 'test'],
			}, (err, result) => {
				assert.ifError(err);
				tid = result.topicData.tid;
				done();
			});
		});

		it('should render tags page', (done) => {
			request(`${nconf.get('url')}/api/tags`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				assert(Array.isArray(body.tags));
				done();
			});
		});

		it('should render tag page with no topics', (done) => {
			request(`${nconf.get('url')}/api/tags/notag`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				assert(Array.isArray(body.topics));
				assert.equal(body.topics.length, 0);
				done();
			});
		});

		it('should render tag page with 1 topic', (done) => {
			request(`${nconf.get('url')}/api/tags/nodebb`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				assert(Array.isArray(body.topics));
				assert.equal(body.topics.length, 1);
				done();
			});
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

		it('should return 503 in maintenance mode', (done) => {
			request(`${nconf.get('url')}/recent`, { json: true }, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 503);
				done();
			});
		});

		it('should return 503 in maintenance mode', (done) => {
			request(`${nconf.get('url')}/api/recent`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 503);
				assert(body);
				done();
			});
		});

		it('should return 200 in maintenance mode', (done) => {
			request(`${nconf.get('url')}/api/login`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});
	});

	describe('account pages', () => {
		let jar;
		before((done) => {
			helpers.loginUser('foo', 'barbar', (err, _jar) => {
				assert.ifError(err);
				jar = _jar;
				done();
			});
		});

		it('should redirect to account page with logged in user', (done) => {
			request(`${nconf.get('url')}/api/login`, { jar: jar, json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(res.headers['x-redirect'], '/user/foo');
				assert.equal(body, '/user/foo');
				done();
			});
		});

		it('should 404 if uid is not a number', (done) => {
			request(`${nconf.get('url')}/api/uid/test`, { json: true }, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should redirect to userslug', (done) => {
			request(`${nconf.get('url')}/api/uid/${fooUid}`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(res.headers['x-redirect'], '/user/foo');
				assert.equal(body, '/user/foo');
				done();
			});
		});

		it('should 404 if user does not exist', (done) => {
			request(`${nconf.get('url')}/api/uid/123123`, { json: true }, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		describe('/me/*', () => {
			it('should redirect to user profile', (done) => {
				request(`${nconf.get('url')}/me`, { jar: jar, json: true }, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body.includes('"template":{"name":"account/profile","account/profile":true}'));
					assert(body.includes('"username":"foo"'));
					done();
				});
			});
			it('api should redirect to /user/[userslug]/bookmarks', (done) => {
				request(`${nconf.get('url')}/api/me/bookmarks`, { jar: jar, json: true }, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert.equal(res.headers['x-redirect'], '/user/foo/bookmarks');
					assert.equal(body, '/user/foo/bookmarks');
					done();
				});
			});
			it('api should redirect to /user/[userslug]/edit/username', (done) => {
				request(`${nconf.get('url')}/api/me/edit/username`, { jar: jar, json: true }, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert.equal(res.headers['x-redirect'], '/user/foo/edit/username');
					assert.equal(body, '/user/foo/edit/username');
					done();
				});
			});
			it('should redirect to login if user is not logged in', (done) => {
				request(`${nconf.get('url')}/me/bookmarks`, { json: true }, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body.includes('Login to your account'), body.substr(0, 500));
					done();
				});
			});
		});

		it('should 401 if user is not logged in', (done) => {
			request(`${nconf.get('url')}/api/admin`, { json: true }, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 401);
				done();
			});
		});

		it('should 403 if user is not admin', (done) => {
			request(`${nconf.get('url')}/api/admin`, { jar: jar, json: true }, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 403);
				done();
			});
		});

		it('should load /user/foo/posts', (done) => {
			request(`${nconf.get('url')}/api/user/foo/posts`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should 401 if not logged in', (done) => {
			request(`${nconf.get('url')}/api/user/foo/bookmarks`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 401);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/bookmarks', (done) => {
			request(`${nconf.get('url')}/api/user/foo/bookmarks`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/upvoted', (done) => {
			request(`${nconf.get('url')}/api/user/foo/upvoted`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/downvoted', (done) => {
			request(`${nconf.get('url')}/api/user/foo/downvoted`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/best', (done) => {
			request(`${nconf.get('url')}/api/user/foo/best`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/watched', (done) => {
			request(`${nconf.get('url')}/api/user/foo/watched`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/ignored', (done) => {
			request(`${nconf.get('url')}/api/user/foo/ignored`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/topics', (done) => {
			request(`${nconf.get('url')}/api/user/foo/topics`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/blocks', (done) => {
			request(`${nconf.get('url')}/api/user/foo/blocks`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/consent', (done) => {
			request(`${nconf.get('url')}/api/user/foo/consent`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/sessions', (done) => {
			request(`${nconf.get('url')}/api/user/foo/sessions`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/categories', (done) => {
			request(`${nconf.get('url')}/api/user/foo/categories`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/uploads', (done) => {
			request(`${nconf.get('url')}/api/user/foo/uploads`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should export users posts', (done) => {
			request(`${nconf.get('url')}/api/user/uid/foo/export/posts`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should export users uploads', (done) => {
			request(`${nconf.get('url')}/api/user/uid/foo/export/uploads`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should export users profile', (done) => {
			request(`${nconf.get('url')}/api/user/uid/foo/export/profile`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load notifications page', (done) => {
			const notifications = require('../src/notifications');
			const notifData = {
				bodyShort: '[[notifications:user_posted_to, test1, test2]]',
				bodyLong: 'some post content',
				pid: 1,
				path: `/post/${1}`,
				nid: `new_post:tid:${1}:pid:${1}:uid:${fooUid}`,
				tid: 1,
				from: fooUid,
				mergeId: `notifications:user_posted_to|${1}`,
				topicTitle: 'topic title',
			};
			async.waterfall([
				function (next) {
					notifications.create(notifData, next);
				},
				function (notification, next) {
					notifications.push(notification, fooUid, next);
				},
				function (next) {
					setTimeout(next, 2500);
				},
				function (next) {
					request(`${nconf.get('url')}/api/notifications`, { jar: jar, json: true }, next);
				},
				function (res, body, next) {
					assert.equal(res.statusCode, 200);
					assert(body);
					const notif = body.notifications[0];
					assert.equal(notif.bodyShort, notifData.bodyShort);
					assert.equal(notif.bodyLong, notifData.bodyLong);
					assert.equal(notif.pid, notifData.pid);
					assert.equal(notif.path, nconf.get('relative_path') + notifData.path);
					assert.equal(notif.nid, notifData.nid);
					next();
				},
			], done);
		});

		it('should 404 if user does not exist', (done) => {
			request(`${nconf.get('url')}/api/user/email/doesnotexist`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				assert(body);
				done();
			});
		});

		it('should load user by uid', (done) => {
			request(`${nconf.get('url')}/api/user/uid/${fooUid}`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load user by username', (done) => {
			request(`${nconf.get('url')}/api/user/username/foo`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load user by email', (done) => {
			request(`${nconf.get('url')}/api/user/email/foo@test.com`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should return 401 if user does not have view:users privilege', (done) => {
			privileges.global.rescind(['groups:view:users'], 'guests', (err) => {
				assert.ifError(err);
				request(`${nconf.get('url')}/api/user/foo`, { json: true }, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 401);
					assert.deepEqual(body, {
						response: {},
						status: {
							code: 'not-authorised',
							message: 'A valid login session was not found. Please log in and try again.',
						},
					});
					privileges.global.give(['groups:view:users'], 'guests', done);
				});
			});
		});

		it('should return false if user can not edit user', (done) => {
			user.create({ username: 'regularJoe', password: 'barbar' }, (err) => {
				assert.ifError(err);
				helpers.loginUser('regularJoe', 'barbar', (err, jar) => {
					assert.ifError(err);
					request(`${nconf.get('url')}/api/user/foo/info`, { jar: jar, json: true }, (err, res) => {
						assert.ifError(err);
						assert.equal(res.statusCode, 403);
						request(`${nconf.get('url')}/api/user/foo/edit`, { jar: jar, json: true }, (err, res) => {
							assert.ifError(err);
							assert.equal(res.statusCode, 403);
							done();
						});
					});
				});
			});
		});

		it('should load correct user', (done) => {
			request(`${nconf.get('url')}/api/user/FOO`, { jar: jar, json: true }, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				done();
			});
		});

		it('should redirect', (done) => {
			request(`${nconf.get('url')}/user/FOO`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should 404 if user does not exist', (done) => {
			request(`${nconf.get('url')}/api/user/doesnotexist`, { jar: jar }, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should not increase profile view if you visit your own profile', (done) => {
			request(`${nconf.get('url')}/api/user/foo`, { jar: jar }, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				setTimeout(() => {
					user.getUserField(fooUid, 'profileviews', (err, viewcount) => {
						assert.ifError(err);
						assert(viewcount === 0);
						done();
					});
				}, 500);
			});
		});

		it('should not increase profile view if a guest visits a profile', (done) => {
			request(`${nconf.get('url')}/api/user/foo`, {}, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				setTimeout(() => {
					user.getUserField(fooUid, 'profileviews', (err, viewcount) => {
						assert.ifError(err);
						assert(viewcount === 0);
						done();
					});
				}, 500);
			});
		});

		it('should increase profile view', (done) => {
			helpers.loginUser('regularJoe', 'barbar', (err, jar) => {
				assert.ifError(err);
				request(`${nconf.get('url')}/api/user/foo`, { jar: jar }, (err, res) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					setTimeout(() => {
						user.getUserField(fooUid, 'profileviews', (err, viewcount) => {
							assert.ifError(err);
							assert(viewcount > 0);
							done();
						});
					}, 500);
				});
			});
		});

		it('should parse about me', (done) => {
			user.setUserFields(fooUid, { picture: '/path/to/picture', aboutme: 'hi i am a bot' }, (err) => {
				assert.ifError(err);
				request(`${nconf.get('url')}/api/user/foo`, { json: true }, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert.equal(body.aboutme, 'hi i am a bot');
					assert.equal(body.picture, '/path/to/picture');
					done();
				});
			});
		});

		it('should not return reputation if reputation is disabled', (done) => {
			meta.config['reputation:disabled'] = 1;
			request(`${nconf.get('url')}/api/user/foo`, { json: true }, (err, res, body) => {
				meta.config['reputation:disabled'] = 0;
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(!body.hasOwnProperty('reputation'));
				done();
			});
		});

		it('should only return posts that are not deleted', (done) => {
			let topicData;
			let pidToDelete;
			async.waterfall([
				function (next) {
					topics.post({ uid: fooUid, title: 'visible', content: 'some content', cid: cid }, next);
				},
				function (data, next) {
					topicData = data.topicData;
					topics.reply({ uid: fooUid, content: '1st reply', tid: topicData.tid }, next);
				},
				function (postData, next) {
					pidToDelete = postData.pid;
					topics.reply({ uid: fooUid, content: '2nd reply', tid: topicData.tid }, next);
				},
				function (postData, next) {
					posts.delete(pidToDelete, fooUid, next);
				},
				function (next) {
					request(`${nconf.get('url')}/api/user/foo`, { json: true }, (err, res, body) => {
						assert.ifError(err);
						assert.equal(res.statusCode, 200);
						const contents = body.posts.map(p => p.content);
						assert(!contents.includes('1st reply'));
						done();
					});
				},
			], done);
		});

		it('should return selected group title', (done) => {
			groups.create({
				name: 'selectedGroup',
			}, (err) => {
				assert.ifError(err);
				user.create({ username: 'groupie' }, (err, uid) => {
					assert.ifError(err);
					groups.join('selectedGroup', uid, (err) => {
						assert.ifError(err);
						request(`${nconf.get('url')}/api/user/groupie`, { json: true }, (err, res, body) => {
							assert.ifError(err);
							assert.equal(res.statusCode, 200);
							assert(Array.isArray(body.selectedGroup));
							assert.equal(body.selectedGroup[0].name, 'selectedGroup');
							done();
						});
					});
				});
			});
		});

		it('should 404 if user does not exist', (done) => {
			groups.join('administrators', fooUid, (err) => {
				assert.ifError(err);
				request(`${nconf.get('url')}/api/user/doesnotexist/edit`, { jar: jar, json: true }, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 404);
					groups.leave('administrators', fooUid, done);
				});
			});
		});

		it('should render edit/password', (done) => {
			request(`${nconf.get('url')}/api/user/foo/edit/password`, { jar: jar, json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				done();
			});
		});

		it('should render edit/email', (done) => {
			request(`${nconf.get('url')}/api/user/foo/edit/email`, { jar: jar, json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				done();
			});
		});

		it('should render edit/username', (done) => {
			request(`${nconf.get('url')}/api/user/foo/edit/username`, { jar: jar, json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				done();
			});
		});
	});

	describe('account follow page', () => {
		const socketUser = require('../src/socket.io/user');
		let uid;
		before((done) => {
			user.create({ username: 'follower' }, (err, _uid) => {
				assert.ifError(err);
				uid = _uid;
				socketUser.follow({ uid: uid }, { uid: fooUid }, (err) => {
					assert.ifError(err);
					socketUser.isFollowing({ uid: uid }, { uid: fooUid }, (err, isFollowing) => {
						assert.ifError(err);
						assert(isFollowing);
						done();
					});
				});
			});
		});

		it('should get followers page', (done) => {
			request(`${nconf.get('url')}/api/user/foo/followers`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(body.users[0].username, 'follower');
				done();
			});
		});

		it('should get following page', (done) => {
			request(`${nconf.get('url')}/api/user/follower/following`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(body.users[0].username, 'foo');
				done();
			});
		});

		it('should return empty after unfollow', (done) => {
			socketUser.unfollow({ uid: uid }, { uid: fooUid }, (err) => {
				assert.ifError(err);
				request(`${nconf.get('url')}/api/user/foo/followers`, { json: true }, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert.equal(body.users.length, 0);
					done();
				});
			});
		});
	});

	describe('post redirect', () => {
		let jar;
		before((done) => {
			helpers.loginUser('foo', 'barbar', (err, _jar) => {
				assert.ifError(err);
				jar = _jar;
				done();
			});
		});

		it('should 404 for invalid pid', (done) => {
			request(`${nconf.get('url')}/api/post/fail`, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should 403 if user does not have read privilege', (done) => {
			privileges.categories.rescind(['groups:topics:read'], category.cid, 'registered-users', (err) => {
				assert.ifError(err);
				request(`${nconf.get('url')}/api/post/${pid}`, { jar: jar }, (err, res) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 403);
					privileges.categories.give(['groups:topics:read'], category.cid, 'registered-users', done);
				});
			});
		});

		it('should return correct post path', (done) => {
			request(`${nconf.get('url')}/api/post/${pid}`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(res.headers['x-redirect'], '/topic/1/test-topic-title/1');
				assert.equal(body, '/topic/1/test-topic-title/1');
				done();
			});
		});
	});

	describe('cookie consent', () => {
		it('should return relevant data in configs API route', (done) => {
			request(`${nconf.get('url')}/api/config`, (err, res, body) => {
				let parsed;
				assert.ifError(err);
				assert.equal(res.statusCode, 200);

				try {
					parsed = JSON.parse(body);
				} catch (e) {
					assert.ifError(e);
				}

				assert.ok(parsed.cookies);
				assert.equal(translator.escape('[[global:cookies.message]]'), parsed.cookies.message);
				assert.equal(translator.escape('[[global:cookies.accept]]'), parsed.cookies.dismiss);
				assert.equal(translator.escape('[[global:cookies.learn_more]]'), parsed.cookies.link);

				done();
			});
		});

		it('response should be parseable when entries have apostrophes', (done) => {
			meta.configs.set('cookieConsentMessage', 'Julian\'s Message', (err) => {
				assert.ifError(err);

				request(`${nconf.get('url')}/api/config`, (err, res, body) => {
					let parsed;
					assert.ifError(err);
					assert.equal(res.statusCode, 200);

					try {
						parsed = JSON.parse(body);
					} catch (e) {
						assert.ifError(e);
					}

					assert.equal('Julian&#x27;s Message', parsed.cookies.message);
					done();
				});
			});
		});
	});

	it('should return osd data', (done) => {
		request(`${nconf.get('url')}/osd.xml`, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	describe('handle errors', () => {
		const plugins = require('../src/plugins');
		after((done) => {
			plugins.loadedHooks['filter:router.page'] = undefined;
			done();
		});

		it('should handle topic malformed uri', (done) => {
			request(`${nconf.get('url')}/topic/1/a%AFc`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should handle category malformed uri', (done) => {
			request(`${nconf.get('url')}/category/1/a%AFc`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should handle malformed uri ', (done) => {
			request(`${nconf.get('url')}/user/a%AFc`, (err, res, body) => {
				assert.ifError(err);
				assert(body);
				assert.equal(res.statusCode, 400);
				done();
			});
		});

		it('should handle malformed uri in api', (done) => {
			request(`${nconf.get('url')}/api/user/a%AFc`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 400);
				assert.equal(body.error, '[[global:400.title]]');
				done();
			});
		});

		it('should handle CSRF error', (done) => {
			plugins.loadedHooks['filter:router.page'] = plugins.loadedHooks['filter:router.page'] || [];
			plugins.loadedHooks['filter:router.page'].push({
				method: function (req, res, next) {
					const err = new Error('csrf-error');
					err.code = 'EBADCSRFTOKEN';
					next(err);
				},
			});

			request(`${nconf.get('url')}/users`, {}, (err, res) => {
				plugins.loadedHooks['filter:router.page'] = [];
				assert.ifError(err);
				assert.equal(res.statusCode, 403);
				done();
			});
		});

		it('should handle black-list error', (done) => {
			plugins.loadedHooks['filter:router.page'] = plugins.loadedHooks['filter:router.page'] || [];
			plugins.loadedHooks['filter:router.page'].push({
				method: function (req, res, next) {
					const err = new Error('blacklist error message');
					err.code = 'blacklisted-ip';
					next(err);
				},
			});

			request(`${nconf.get('url')}/users`, {}, (err, res, body) => {
				plugins.loadedHooks['filter:router.page'] = [];
				assert.ifError(err);
				assert.equal(res.statusCode, 403);
				assert.equal(body, 'blacklist error message');
				done();
			});
		});

		it('should handle page redirect through error', (done) => {
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

			request(`${nconf.get('url')}/users`, {}, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should handle api page redirect through error', (done) => {
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

			request(`${nconf.get('url')}/api/users`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(res.headers['x-redirect'], '/api/popular');
				assert(body, '/api/popular');
				done();
			});
		});

		it('should handle error page', (done) => {
			plugins.loadedHooks['filter:router.page'] = plugins.loadedHooks['filter:router.page'] || [];
			plugins.loadedHooks['filter:router.page'].push({
				method: function (req, res, next) {
					const err = new Error('regular error');
					next(err);
				},
			});

			request(`${nconf.get('url')}/users`, (err, res, body) => {
				plugins.loadedHooks['filter:router.page'] = [];
				assert.ifError(err);
				assert.equal(res.statusCode, 500);
				assert(body);
				done();
			});
		});
	});

	describe('timeago locales', () => {
		it('should load timeago locale', (done) => {
			request(`${nconf.get('url')}/assets/src/modules/timeago/locales/jquery.timeago.af.js`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body.includes('"gelede"'));
				done();
			});
		});

		it('should return not found if NodeBB language exists but timeago locale does not exist', (done) => {
			request(`${nconf.get('url')}/assets/src/modules/timeago/locales/jquery.timeago.ms.js`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should return not found if NodeBB language does not exist', (done) => {
			request(`${nconf.get('url')}/assets/src/modules/timeago/locales/jquery.timeago.muggle.js`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});
	});

	describe('category', () => {
		let jar;
		before((done) => {
			helpers.loginUser('foo', 'barbar', (err, _jar) => {
				assert.ifError(err);
				jar = _jar;
				done();
			});
		});

		it('should return 404 if cid is not a number', (done) => {
			request(`${nconf.get('url')}/api/category/fail`, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should return 404 if topic index is not a number', (done) => {
			request(`${nconf.get('url')}/api/category/${category.slug}/invalidtopicindex`, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should 404 if category does not exist', (done) => {
			request(`${nconf.get('url')}/api/category/123123`, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should 404 if category is disabled', (done) => {
			categories.create({ name: 'disabled' }, (err, category) => {
				assert.ifError(err);
				categories.setCategoryField(category.cid, 'disabled', 1, (err) => {
					assert.ifError(err);
					request(`${nconf.get('url')}/api/category/${category.slug}`, (err, res) => {
						assert.ifError(err);
						assert.equal(res.statusCode, 404);
						done();
					});
				});
			});
		});

		it('should return 401 if not allowed to read', (done) => {
			categories.create({ name: 'hidden' }, (err, category) => {
				assert.ifError(err);
				privileges.categories.rescind(['groups:read'], category.cid, 'guests', (err) => {
					assert.ifError(err);
					request(`${nconf.get('url')}/api/category/${category.slug}`, (err, res) => {
						assert.ifError(err);
						assert.equal(res.statusCode, 401);
						done();
					});
				});
			});
		});

		it('should redirect if topic index is negative', (done) => {
			request(`${nconf.get('url')}/api/category/${category.slug}/-10`, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.ok(res.headers['x-redirect']);
				done();
			});
		});

		it('should 404 if page is not found', (done) => {
			user.setSetting(fooUid, 'usePagination', 1, (err) => {
				assert.ifError(err);
				request(`${nconf.get('url')}/api/category/${category.slug}?page=100`, { jar: jar, json: true }, (err, res) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 404);
					done();
				});
			});
		});

		it('should load page 1 if req.query.page is not sent', (done) => {
			request(`${nconf.get('url')}/api/category/${category.slug}`, { jar: jar, json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(body.pagination.currentPage, 1);
				done();
			});
		});

		it('should sort topics by most posts', (done) => {
			async.waterfall([
				function (next) {
					categories.create({ name: 'most-posts-category' }, next);
				},
				function (category, next) {
					async.waterfall([
						function (next) {
							topics.post({ uid: fooUid, cid: category.cid, title: 'topic 1', content: 'topic 1 OP' }, next);
						},
						function (data, next) {
							topics.post({ uid: fooUid, cid: category.cid, title: 'topic 2', content: 'topic 2 OP' }, next);
						},
						function (data, next) {
							topics.reply({ uid: fooUid, content: 'topic 2 reply', tid: data.topicData.tid }, next);
						},
						function (postData, next) {
							request(`${nconf.get('url')}/api/category/${category.slug}?sort=most_posts`, { jar: jar, json: true }, (err, res, body) => {
								assert.ifError(err);
								assert.equal(res.statusCode, 200);
								assert.equal(body.topics[0].title, 'topic 2');
								assert.equal(body.topics[0].postcount, 2);
								assert.equal(body.topics[1].postcount, 1);
								next();
							});
						},
					], (err) => {
						next(err);
					});
				},
			], done);
		});

		it('should load a specific users topics from a category with tags', (done) => {
			async.waterfall([
				function (next) {
					categories.create({ name: 'filtered-category' }, next);
				},
				function (category, next) {
					async.waterfall([
						function (next) {
							topics.post({ uid: fooUid, cid: category.cid, title: 'topic 1', content: 'topic 1 OP', tags: ['java', 'cpp'] }, next);
						},
						function (data, next) {
							topics.post({ uid: fooUid, cid: category.cid, title: 'topic 2', content: 'topic 2 OP', tags: ['node', 'javascript'] }, next);
						},
						function (data, next) {
							topics.post({ uid: fooUid, cid: category.cid, title: 'topic 3', content: 'topic 3 OP', tags: ['java', 'cpp', 'best'] }, next);
						},
						function (data, next) {
							request(`${nconf.get('url')}/api/category/${category.slug}?tag=node&author=foo`, { jar: jar, json: true }, (err, res, body) => {
								assert.ifError(err);
								assert.equal(res.statusCode, 200);
								assert.equal(body.topics[0].title, 'topic 2');
								next();
							});
						},
						function (next) {
							request(`${nconf.get('url')}/api/category/${category.slug}?tag[]=java&tag[]=cpp`, { jar: jar, json: true }, (err, res, body) => {
								assert.ifError(err);
								assert.equal(res.statusCode, 200);
								assert.equal(body.topics[0].title, 'topic 3');
								assert.equal(body.topics[1].title, 'topic 1');
								next();
							});
						},
					], (err) => {
						next(err);
					});
				},
			], done);
		});

		it('should redirect if category is a link', (done) => {
			let cid;
			let category;
			async.waterfall([
				function (next) {
					categories.create({ name: 'redirect', link: 'https://nodebb.org' }, next);
				},
				function (_category, next) {
					category = _category;
					cid = category.cid;
					request(`${nconf.get('url')}/api/category/${category.slug}`, { jar: jar, json: true }, (err, res, body) => {
						assert.ifError(err);
						assert.equal(res.statusCode, 200);
						assert.equal(res.headers['x-redirect'], 'https://nodebb.org');
						assert.equal(body, 'https://nodebb.org');
						next();
					});
				},
				function (next) {
					categories.setCategoryField(cid, 'link', '/recent', next);
				},
				function (next) {
					request(`${nconf.get('url')}/api/category/${category.slug}`, { jar: jar, json: true }, (err, res, body) => {
						assert.ifError(err);
						assert.equal(res.statusCode, 200);
						assert.equal(res.headers['x-redirect'], '/recent');
						assert.equal(body, '/recent');
						next();
					});
				},
			], done);
		});

		it('should get recent topic replies from children categories', (done) => {
			let parentCategory;
			let childCategory1;
			let childCategory2;

			async.waterfall([
				function (next) {
					categories.create({ name: 'parent category', backgroundImage: 'path/to/some/image' }, next);
				},
				function (category, next) {
					parentCategory = category;
					async.waterfall([
						function (next) {
							categories.create({ name: 'child category 1', parentCid: category.cid }, next);
						},
						function (category, next) {
							childCategory1 = category;
							categories.create({ name: 'child category 2', parentCid: parentCategory.cid }, next);
						},
						function (category, next) {
							childCategory2 = category;
							topics.post({ uid: fooUid, cid: childCategory2.cid, title: 'topic 1', content: 'topic 1 OP' }, next);
						},
						function (data, next) {
							request(`${nconf.get('url')}/api/category/${parentCategory.slug}`, { jar: jar, json: true }, (err, res, body) => {
								assert.ifError(err);
								assert.equal(res.statusCode, 200);
								assert.equal(body.children[1].posts[0].content, 'topic 1 OP');
								next();
							});
						},
					], (err) => {
						next(err);
					});
				},
			], done);
		});

		it('should create 2 pages of topics', (done) => {
			async.waterfall([
				function (next) {
					categories.create({ name: 'category with 2 pages' }, next);
				},
				function (category, next) {
					const titles = [];
					for (let i = 0; i < 30; i++) {
						titles.push(`topic title ${i}`);
					}

					async.waterfall([
						function (next) {
							async.eachSeries(titles, (title, next) => {
								topics.post({ uid: fooUid, cid: category.cid, title: title, content: 'does not really matter' }, next);
							}, next);
						},
						function (next) {
							user.getSettings(fooUid, next);
						},
						function (settings, next) {
							request(`${nconf.get('url')}/api/category/${category.slug}`, { jar: jar, json: true }, (err, res, body) => {
								assert.ifError(err);
								assert.equal(res.statusCode, 200);
								assert.equal(body.topics.length, settings.topicsPerPage);
								assert.equal(body.pagination.pageCount, 2);
								next();
							});
						},
					], (err) => {
						next(err);
					});
				},
			], done);
		});
	});

	describe('unread', () => {
		let jar;
		before((done) => {
			helpers.loginUser('foo', 'barbar', (err, _jar) => {
				assert.ifError(err);
				jar = _jar;
				done();
			});
		});

		it('should load unread page', (done) => {
			request(`${nconf.get('url')}/api/unread`, { jar: jar }, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				done();
			});
		});

		it('should 404 if filter is invalid', (done) => {
			request(`${nconf.get('url')}/api/unread/doesnotexist`, { jar: jar }, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should return total unread count', (done) => {
			request(`${nconf.get('url')}/api/unread/total?filter=new`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(body, 0);
				done();
			});
		});

		it('should redirect if page is out of bounds', (done) => {
			request(`${nconf.get('url')}/api/unread?page=-1`, { jar: jar, json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(res.headers['x-redirect'], '/unread?page=1');
				assert.equal(body, '/unread?page=1');
				done();
			});
		});
	});

	describe('admin middlewares', () => {
		it('should redirect to login', (done) => {
			request(`${nconf.get('url')}//api/admin/advanced/database`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 401);
				done();
			});
		});

		it('should redirect to login', (done) => {
			request(`${nconf.get('url')}//admin/advanced/database`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body.includes('Login to your account'));
				done();
			});
		});
	});

	describe('composer', () => {
		let csrf_token;
		let jar;

		before((done) => {
			helpers.loginUser('foo', 'barbar', (err, _jar) => {
				assert.ifError(err);
				jar = _jar;

				request({
					url: `${nconf.get('url')}/api/config`,
					json: true,
					jar: jar,
				}, (err, response, body) => {
					assert.ifError(err);
					csrf_token = body.csrf_token;
					done();
				});
			});
		});

		it('should load the composer route', (done) => {
			request(`${nconf.get('url')}/api/compose`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body.title);
				assert(body.template);
				assert.equal(body.url, `${nconf.get('relative_path')}/compose`);
				done();
			});
		});

		it('should load the composer route if disabled by plugin', (done) => {
			function hookMethod(hookData, callback) {
				hookData.templateData.disabled = true;
				callback(null, hookData);
			}

			plugins.hooks.register('myTestPlugin', {
				hook: 'filter:composer.build',
				method: hookMethod,
			});

			request(`${nconf.get('url')}/api/compose`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body.title);
				assert.strictEqual(body.template.name, '');
				assert.strictEqual(body.url, `${nconf.get('relative_path')}/compose`);

				plugins.hooks.unregister('myTestPlugin', 'filter:composer.build', hookMethod);
				done();
			});
		});

		it('should 404 if plugin calls next', (done) => {
			function hookMethod(hookData, callback) {
				hookData.next();
			}

			plugins.hooks.register('myTestPlugin', {
				hook: 'filter:composer.build',
				method: hookMethod,
			});

			request(`${nconf.get('url')}/api/compose`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);

				plugins.hooks.unregister('myTestPlugin', 'filter:composer.build', hookMethod);
				done();
			});
		});


		it('should error with invalid data', (done) => {
			request.post(`${nconf.get('url')}/compose`, {
				form: {
					content: 'a new reply',
				},
				jar: jar,
				headers: {
					'x-csrf-token': csrf_token,
				},
			}, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 400);
				request.post(`${nconf.get('url')}/compose`, {
					form: {
						tid: tid,
					},
					jar: jar,
					headers: {
						'x-csrf-token': csrf_token,
					},
				}, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 400);
					done();
				});
			});
		});

		it('should create a new topic and reply by composer route', (done) => {
			const data = {
				cid: cid,
				title: 'no js is good',
				content: 'a topic with noscript',
			};
			request.post(`${nconf.get('url')}/compose`, {
				form: data,
				jar: jar,
				headers: {
					'x-csrf-token': csrf_token,
				},
			}, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 302);
				request.post(`${nconf.get('url')}/compose`, {
					form: {
						tid: tid,
						content: 'a new reply',
					},
					jar: jar,
					headers: {
						'x-csrf-token': csrf_token,
					},
				}, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 302);
					done();
				});
			});
		});
	});

	after((done) => {
		const analytics = require('../src/analytics');
		analytics.writeData(done);
	});
});

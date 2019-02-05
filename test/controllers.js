'use strict';

var async = require('async');
var assert = require('assert');
var nconf = require('nconf');
var request = require('request');
var fs = require('fs');
var path = require('path');

var db = require('./mocks/databasemock');
var categories = require('../src/categories');
var topics = require('../src/topics');
var posts = require('../src/posts');
var user = require('../src/user');
var groups = require('../src/groups');
var meta = require('../src/meta');
var translator = require('../src/translator');
var privileges = require('../src/privileges');
var plugins = require('../src/plugins');
var utils = require('../src/utils');
var helpers = require('./helpers');

describe('Controllers', function () {
	var tid;
	var cid;
	var pid;
	var fooUid;
	var category;

	before(function (done) {
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
				var navigation = require('../src/navigation/admin');
				var data = require('../install/data/navigation.json');

				navigation.save(data, next);
			},
		}, function (err, results) {
			if (err) {
				return done(err);
			}
			category = results.category;
			cid = results.category.cid;
			fooUid = results.user;

			topics.post({ uid: results.user, title: 'test topic title', content: 'test topic content', cid: results.category.cid }, function (err, result) {
				tid = result.topicData.tid;
				pid = result.postData.pid;
				done(err);
			});
		});
	});

	it('should load /config with csrf_token', function (done) {
		request({
			url: nconf.get('url') + '/api/config',
			json: true,
		}, function (err, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 200);
			assert(body.csrf_token);
			done();
		});
	});

	it('should load /config with no csrf_token as spider', function (done) {
		request({
			url: nconf.get('url') + '/api/config',
			json: true,
			headers: {
				'user-agent': 'yandex',
			},
		}, function (err, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 200);
			assert.strictEqual(body.csrf_token, false);
			assert.strictEqual(body.uid, -1);
			assert.strictEqual(body.loggedIn, false);
			done();
		});
	});

	describe('homepage', function () {
		function hookMethod(hookData) {
			assert(hookData.req);
			assert(hookData.res);
			assert(hookData.next);

			hookData.res.render('custom', {
				works: true,
			});
		}
		var message = utils.generateUUID();
		var name = 'custom.tpl';
		var tplPath = path.join(nconf.get('views_dir'), name);

		before(function (done) {
			plugins.registerHook('myTestPlugin', {
				hook: 'action:homepage.get:custom',
				method: hookMethod,
			});

			fs.writeFileSync(tplPath, message);
			meta.templates.compileTemplate(name, message, done);
		});

		it('should load default', function (done) {
			request(nconf.get('url'), function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load unread', function (done) {
			meta.configs.set('homePageRoute', 'unread', function (err) {
				assert.ifError(err);

				request(nconf.get('url'), function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body);
					done();
				});
			});
		});

		it('should load recent', function (done) {
			meta.configs.set('homePageRoute', 'recent', function (err) {
				assert.ifError(err);

				request(nconf.get('url'), function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body);
					done();
				});
			});
		});

		it('should load top', function (done) {
			meta.configs.set('homePageRoute', 'top', function (err) {
				assert.ifError(err);

				request(nconf.get('url'), function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body);
					done();
				});
			});
		});

		it('should load popular', function (done) {
			meta.configs.set('homePageRoute', 'popular', function (err) {
				assert.ifError(err);

				request(nconf.get('url'), function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body);
					done();
				});
			});
		});

		it('should load category', function (done) {
			meta.configs.set('homePageRoute', 'category/1/test-category', function (err) {
				assert.ifError(err);

				request(nconf.get('url'), function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body);
					done();
				});
			});
		});

		it('should not load breadcrumbs on home page route', function (done) {
			request(nconf.get('url') + '/api', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				assert(!body.breadcrumbs);
				done();
			});
		});

		it('should redirect to custom', function (done) {
			meta.configs.set('homePageRoute', 'groups', function (err) {
				assert.ifError(err);

				request(nconf.get('url'), function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body);
					done();
				});
			});
		});

		it('should 404 if custom does not exist', function (done) {
			meta.configs.set('homePageRoute', 'this-route-does-not-exist', function (err) {
				assert.ifError(err);

				request(nconf.get('url'), function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 404);
					assert(body);
					done();
				});
			});
		});

		it('api should work with hook', function (done) {
			meta.configs.set('homePageRoute', 'custom', function (err) {
				assert.ifError(err);

				request(nconf.get('url') + '/api', { json: true }, function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert.equal(body.works, true);
					assert.equal(body.template.custom, true);

					done();
				});
			});
		});

		it('should render with hook', function (done) {
			meta.configs.set('homePageRoute', 'custom', function (err) {
				assert.ifError(err);

				request(nconf.get('url'), function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert.ok(body);
					assert.ok(body.indexOf('<main id="panel"'));
					assert.ok(body.includes(message));

					done();
				});
			});
		});

		after(function () {
			plugins.unregisterHook('myTestPlugin', 'action:homepage.get:custom', hookMethod);
			fs.unlinkSync(tplPath);
			fs.unlinkSync(tplPath.replace(/\.tpl$/, '.js'));
		});
	});

	it('should load /reset without code', function (done) {
		request(nconf.get('url') + '/reset', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /reset with invalid code', function (done) {
		request(nconf.get('url') + '/reset/123123', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /login', function (done) {
		request(nconf.get('url') + '/login', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /register', function (done) {
		request(nconf.get('url') + '/register', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /register/complete', function (done) {
		function hookMethod(data, next) {
			data.interstitials.push({ template: 'topic.tpl', data: {} });
			next(null, data);
		}

		plugins.registerHook('myTestPlugin', {
			hook: 'filter:register.interstitial',
			method: hookMethod,
		});

		var data = {
			username: 'interstitial',
			password: '123456',
			'password-confirm': '123456',
			email: 'test@me.com',
		};

		var jar = request.jar();
		request({
			url: nconf.get('url') + '/api/config',
			json: true,
			jar: jar,
		}, function (err, response, body) {
			assert.ifError(err);

			request.post(nconf.get('url') + '/register', {
				form: data,
				json: true,
				jar: jar,
				headers: {
					'x-csrf-token': body.csrf_token,
				},
			}, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(body.referrer, nconf.get('relative_path') + '/register/complete');
				request(nconf.get('url') + '/api/register/complete', {
					jar: jar,
					json: true,
				}, function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body.sections);
					assert(body.errors);
					assert(body.title);
					plugins.unregisterHook('myTestPlugin', 'filter:register.interstitial', hookMethod);
					done();
				});
			});
		});
	});

	it('should load /robots.txt', function (done) {
		request(nconf.get('url') + '/robots.txt', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /manifest.json', function (done) {
		request(nconf.get('url') + '/manifest.json', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /outgoing?url=<url>', function (done) {
		request(nconf.get('url') + '/outgoing?url=http://youtube.com', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should 404 on /outgoing with no url', function (done) {
		request(nconf.get('url') + '/outgoing', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			assert(body);
			done();
		});
	});

	it('should 404 on /outgoing with javascript: protocol', function (done) {
		request(nconf.get('url') + '/outgoing?url=javascript:alert(1);', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			assert(body);
			done();
		});
	});

	it('should 404 on /outgoing with invalid url', function (done) {
		request(nconf.get('url') + '/outgoing?url=derp', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			assert(body);
			done();
		});
	});

	it('should load /tos', function (done) {
		meta.config.termsOfUse = 'please accept our tos';
		request(nconf.get('url') + '/tos', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});


	it('should load 404 if meta.config.termsOfUse is empty', function (done) {
		meta.config.termsOfUse = '';
		request(nconf.get('url') + '/tos', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			assert(body);
			done();
		});
	});

	it('should load /sping', function (done) {
		request(nconf.get('url') + '/sping', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert.equal(body, 'healthy');
			done();
		});
	});

	it('should load /ping', function (done) {
		request(nconf.get('url') + '/ping', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert.equal(body, '200');
			done();
		});
	});

	it('should handle 404', function (done) {
		request(nconf.get('url') + '/arouteinthevoid', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			assert(body);
			done();
		});
	});

	it('should load topic rss feed', function (done) {
		request(nconf.get('url') + '/topic/' + tid + '.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load category rss feed', function (done) {
		request(nconf.get('url') + '/category/' + cid + '.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load topics rss feed', function (done) {
		request(nconf.get('url') + '/topics.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load recent rss feed', function (done) {
		request(nconf.get('url') + '/recent.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load top rss feed', function (done) {
		request(nconf.get('url') + '/top.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load popular rss feed', function (done) {
		request(nconf.get('url') + '/popular.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load popular rss feed with term', function (done) {
		request(nconf.get('url') + '/popular/day.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load recent posts rss feed', function (done) {
		request(nconf.get('url') + '/recentposts.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load category recent posts rss feed', function (done) {
		request(nconf.get('url') + '/category/' + cid + '/recentposts.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load user topics rss feed', function (done) {
		request(nconf.get('url') + '/user/foo/topics.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load tag rss feed', function (done) {
		request(nconf.get('url') + '/tags/nodebb.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load stylesheet.css', function (done) {
		request(nconf.get('url') + '/assets/stylesheet.css', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load admin.css', function (done) {
		request(nconf.get('url') + '/assets/admin.css', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});


	it('should load nodebb.min.js', function (done) {
		request(nconf.get('url') + '/assets/nodebb.min.js', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load acp.min.js', function (done) {
		request(nconf.get('url') + '/assets/acp.min.js', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load sitemap.xml', function (done) {
		request(nconf.get('url') + '/sitemap.xml', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load sitemap/pages.xml', function (done) {
		request(nconf.get('url') + '/sitemap/pages.xml', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load sitemap/categories.xml', function (done) {
		request(nconf.get('url') + '/sitemap/categories.xml', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load sitemap/topics/1.xml', function (done) {
		request(nconf.get('url') + '/sitemap/topics.1.xml', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load robots.txt', function (done) {
		request(nconf.get('url') + '/robots.txt', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load manifest.json', function (done) {
		request(nconf.get('url') + '/manifest.json', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load theme screenshot', function (done) {
		request(nconf.get('url') + '/css/previews/nodebb-theme-persona', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load users page', function (done) {
		request(nconf.get('url') + '/users', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load users page', function (done) {
		request(nconf.get('url') + '/users?section=online', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should error if guests do not have search privilege', function (done) {
		request(nconf.get('url') + '/api/users?term=bar&section=sort-posts', { json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 500);
			assert(body);
			assert.equal(body.error, '[[error:no-privileges]]');
			done();
		});
	});

	it('should load users search page', function (done) {
		privileges.global.give(['search:users'], 'guests', function (err) {
			assert.ifError(err);
			request(nconf.get('url') + '/users?term=bar&section=sort-posts', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				privileges.global.rescind(['search:users'], 'guests', done);
			});
		});
	});

	it('should load groups page', function (done) {
		request(nconf.get('url') + '/groups', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load group details page', function (done) {
		groups.create({
			name: 'group-details',
			description: 'Foobar!',
			hidden: 0,
		}, function (err) {
			assert.ifError(err);
			groups.join('group-details', fooUid, function (err) {
				assert.ifError(err);
				topics.post({
					uid: fooUid,
					title: 'topic title',
					content: 'test topic content',
					cid: cid,
				}, function (err) {
					assert.ifError(err);
					request(nconf.get('url') + '/api/groups/group-details', { json: true }, function (err, res, body) {
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

	it('should load group members page', function (done) {
		request(nconf.get('url') + '/groups/group-details/members', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should 404 when trying to load group members of hidden group', function (done) {
		var groups = require('../src/groups');
		groups.create({
			name: 'hidden-group',
			description: 'Foobar!',
			hidden: 1,
		}, function (err) {
			assert.ifError(err);
			request(nconf.get('url') + '/groups/hidden-group/members', function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});
	});

	it('should get recent posts', function (done) {
		request(nconf.get('url') + '/api/recent/posts/month', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should get post data', function (done) {
		request(nconf.get('url') + '/api/post/pid/' + pid, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should get topic data', function (done) {
		request(nconf.get('url') + '/api/topic/tid/' + tid, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should get category data', function (done) {
		request(nconf.get('url') + '/api/category/cid/' + cid, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});


	describe('revoke session', function () {
		var uid;
		var jar;
		var csrf_token;

		before(function (done) {
			user.create({ username: 'revokeme', password: 'barbar' }, function (err, _uid) {
				assert.ifError(err);
				uid = _uid;
				helpers.loginUser('revokeme', 'barbar', function (err, _jar, _csrf_token) {
					assert.ifError(err);
					jar = _jar;
					csrf_token = _csrf_token;
					done();
				});
			});
		});

		it('should fail to revoke session with missing uuid', function (done) {
			request.del(nconf.get('url') + '/api/user/revokeme/session', {
				jar: jar,
				headers: {
					'x-csrf-token': csrf_token,
				},
			}, function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should fail if user doesn\'t exist', function (done) {
			request.del(nconf.get('url') + '/api/user/doesnotexist/session/1112233', {
				jar: jar,
				headers: {
					'x-csrf-token': csrf_token,
				},
			}, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 403);
				assert.deepEqual(JSON.parse(body), {
					path: '/user/doesnotexist/session/1112233',
					loggedIn: true,
					title: '[[global:403.title]]',
				});
				done();
			});
		});

		it('should revoke user session', function (done) {
			db.getSortedSetRange('uid:' + uid + ':sessions', 0, -1, function (err, sids) {
				assert.ifError(err);
				var sid = sids[0];

				db.sessionStore.get(sid, function (err, sessionObj) {
					assert.ifError(err);
					request.del(nconf.get('url') + '/api/user/revokeme/session/' + sessionObj.meta.uuid, {
						jar: jar,
						headers: {
							'x-csrf-token': csrf_token,
						},
					}, function (err, res, body) {
						assert.ifError(err);
						assert.equal(res.statusCode, 200);
						assert.equal(body, 'OK');
						done();
					});
				});
			});
		});
	});

	describe('widgets', function () {
		var widgets = require('../src/widgets');

		before(function (done) {
			async.waterfall([
				function (next) {
					widgets.reset(next);
				},
				function (next) {
					var data = {
						template: 'categories.tpl',
						location: 'sidebar',
						widgets: [
							{
								widget: 'html',
								data: [{
									widget: 'html',
									data: {
										html: 'test',
										title: '',
										container: '',
									},
								}],
							},
						],
					};

					widgets.setArea(data, next);
				},
			], done);
		});

		it('should return {} if there are no widgets', function (done) {
			request(nconf.get('url') + '/api/category/' + cid, { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body.widgets);
				assert.equal(Object.keys(body.widgets).length, 0);
				done();
			});
		});

		it('should render templates', function (done) {
			var url = nconf.get('url') + '/api/categories';
			request(url, { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body.widgets);
				assert(body.widgets.sidebar);
				done();
			});
		});

		it('should reset templates', function (done) {
			widgets.resetTemplates(['categories', 'category'], function (err) {
				assert.ifError(err);
				request(nconf.get('url') + '/api/categories', { json: true }, function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body.widgets);
					assert.equal(Object.keys(body.widgets).length, 0);
					done();
				});
			});
		});
	});

	describe('tags', function () {
		var tid;
		before(function (done) {
			topics.post({
				uid: fooUid,
				title: 'topic title',
				content: 'test topic content',
				cid: cid,
				tags: ['nodebb', 'bug', 'test'],
			}, function (err, result) {
				assert.ifError(err);
				tid = result.topicData.tid;
				done();
			});
		});

		it('should render tags page', function (done) {
			request(nconf.get('url') + '/api/tags', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				assert(Array.isArray(body.tags));
				done();
			});
		});

		it('should render tag page with no topics', function (done) {
			request(nconf.get('url') + '/api/tags/notag', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				assert(Array.isArray(body.topics));
				assert.equal(body.topics.length, 0);
				done();
			});
		});

		it('should render tag page with 1 topic', function (done) {
			request(nconf.get('url') + '/api/tags/nodebb', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				assert(Array.isArray(body.topics));
				assert.equal(body.topics.length, 1);
				done();
			});
		});
	});


	describe('maintenance mode', function () {
		before(function (done) {
			meta.config.maintenanceMode = 1;
			done();
		});
		after(function (done) {
			meta.config.maintenanceMode = 0;
			done();
		});

		it('should return 503 in maintenance mode', function (done) {
			request(nconf.get('url') + '/recent', { json: true }, function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 503);
				done();
			});
		});

		it('should return 503 in maintenance mode', function (done) {
			request(nconf.get('url') + '/api/recent', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 503);
				assert(body);
				done();
			});
		});

		it('should return 200 in maintenance mode', function (done) {
			request(nconf.get('url') + '/api/login', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});
	});

	describe('account pages', function () {
		var jar;
		before(function (done) {
			helpers.loginUser('foo', 'barbar', function (err, _jar) {
				assert.ifError(err);
				jar = _jar;
				done();
			});
		});

		it('should redirect to account page with logged in user', function (done) {
			request(nconf.get('url') + '/api/login', { jar: jar, json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(res.headers['x-redirect'], '/user/foo');
				assert.equal(body, '/user/foo');
				done();
			});
		});

		it('should 404 if uid is not a number', function (done) {
			request(nconf.get('url') + '/api/uid/test', { json: true }, function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should redirect to userslug', function (done) {
			request(nconf.get('url') + '/api/uid/' + fooUid, { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(res.headers['x-redirect'], '/user/foo');
				assert.equal(body, '/user/foo');
				done();
			});
		});

		it('should 404 if user does not exist', function (done) {
			request(nconf.get('url') + '/api/uid/123123', { json: true }, function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		describe('/me/*', function () {
			it('api should redirect to /user/[userslug]/bookmarks', function (done) {
				request(nconf.get('url') + '/api/me/bookmarks', { jar: jar, json: true }, function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert.equal(res.headers['x-redirect'], '/user/foo/bookmarks');
					assert.equal(body, '/user/foo/bookmarks');
					done();
				});
			});
			it('api should redirect to /user/[userslug]/edit/username', function (done) {
				request(nconf.get('url') + '/api/me/edit/username', { jar: jar, json: true }, function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert.equal(res.headers['x-redirect'], '/user/foo/edit/username');
					assert.equal(body, '/user/foo/edit/username');
					done();
				});
			});
			it('should redirect to login if user is not logged in', function (done) {
				request(nconf.get('url') + '/me/bookmarks', { json: true }, function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body.includes('Login to your account'));
					done();
				});
			});
		});

		it('should 401 if user is not logged in', function (done) {
			request(nconf.get('url') + '/api/admin', { json: true }, function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 401);
				done();
			});
		});

		it('should 403 if user is not admin', function (done) {
			request(nconf.get('url') + '/api/admin', { jar: jar, json: true }, function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 403);
				done();
			});
		});

		it('should load /user/foo/posts', function (done) {
			request(nconf.get('url') + '/api/user/foo/posts', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should 401 if not logged in', function (done) {
			request(nconf.get('url') + '/api/user/foo/bookmarks', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 401);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/bookmarks', function (done) {
			request(nconf.get('url') + '/api/user/foo/bookmarks', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/upvoted', function (done) {
			request(nconf.get('url') + '/api/user/foo/upvoted', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/downvoted', function (done) {
			request(nconf.get('url') + '/api/user/foo/downvoted', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/best', function (done) {
			request(nconf.get('url') + '/api/user/foo/best', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/watched', function (done) {
			request(nconf.get('url') + '/api/user/foo/watched', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/ignored', function (done) {
			request(nconf.get('url') + '/api/user/foo/ignored', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/topics', function (done) {
			request(nconf.get('url') + '/api/user/foo/topics', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/blocks', function (done) {
			request(nconf.get('url') + '/api/user/foo/blocks', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/consent', function (done) {
			request(nconf.get('url') + '/api/user/foo/consent', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/sessions', function (done) {
			request(nconf.get('url') + '/api/user/foo/sessions', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/categories', function (done) {
			request(nconf.get('url') + '/api/user/foo/categories', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load /user/foo/uploads', function (done) {
			request(nconf.get('url') + '/api/user/foo/uploads', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should export users posts', function (done) {
			request(nconf.get('url') + '/api/user/uid/foo/export/posts', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should export users uploads', function (done) {
			request(nconf.get('url') + '/api/user/uid/foo/export/uploads', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should export users profile', function (done) {
			request(nconf.get('url') + '/api/user/uid/foo/export/profile', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load notifications page', function (done) {
			var notifications = require('../src/notifications');
			var notifData = {
				bodyShort: '[[notifications:user_posted_to, test1, test2]]',
				bodyLong: 'some post content',
				pid: 1,
				path: '/post/' + 1,
				nid: 'new_post:tid:' + 1 + ':pid:' + 1 + ':uid:' + fooUid,
				tid: 1,
				from: fooUid,
				mergeId: 'notifications:user_posted_to|' + 1,
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
					request(nconf.get('url') + '/api/notifications', { jar: jar, json: true }, next);
				},
				function (res, body, next) {
					assert.equal(res.statusCode, 200);
					assert(body);
					var notif = body.notifications[0];
					assert.equal(notif.bodyShort, notifData.bodyShort);
					assert.equal(notif.bodyLong, notifData.bodyLong);
					assert.equal(notif.pid, notifData.pid);
					assert.equal(notif.path, notifData.path);
					assert.equal(notif.nid, notifData.nid);
					next();
				},
			], done);
		});

		it('should 404 if user does not exist', function (done) {
			request(nconf.get('url') + '/api/user/email/doesnotexist', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				assert(body);
				done();
			});
		});

		it('should load user by uid', function (done) {
			request(nconf.get('url') + '/api/user/uid/' + fooUid, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load user by username', function (done) {
			request(nconf.get('url') + '/api/user/username/foo', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load user by email', function (done) {
			request(nconf.get('url') + '/api/user/email/foo@test.com', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should return 401 if user does not have view:users privilege', function (done) {
			privileges.global.rescind(['view:users'], 'guests', function (err) {
				assert.ifError(err);
				request(nconf.get('url') + '/api/user/foo', { json: true }, function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 401);
					assert.equal(body, 'not-authorized');
					privileges.global.give(['view:users'], 'guests', done);
				});
			});
		});

		it('should return false if user can not edit user', function (done) {
			user.create({ username: 'regularJoe', password: 'barbar' }, function (err) {
				assert.ifError(err);
				helpers.loginUser('regularJoe', 'barbar', function (err, jar) {
					assert.ifError(err);
					request(nconf.get('url') + '/api/user/foo/info', { jar: jar, json: true }, function (err, res) {
						assert.ifError(err);
						assert.equal(res.statusCode, 403);
						request(nconf.get('url') + '/api/user/foo/edit', { jar: jar, json: true }, function (err, res) {
							assert.ifError(err);
							assert.equal(res.statusCode, 403);
							done();
						});
					});
				});
			});
		});

		it('should load correct user', function (done) {
			request(nconf.get('url') + '/api/user/FOO', { jar: jar, json: true }, function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				done();
			});
		});

		it('should redirect', function (done) {
			request(nconf.get('url') + '/user/FOO', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should 404 if user does not exist', function (done) {
			request(nconf.get('url') + '/api/user/doesnotexist', { jar: jar }, function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should increase profile view', function (done) {
			request(nconf.get('url') + '/api/user/foo', { }, function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				user.getUserField(fooUid, 'profileviews', function (err, viewcount) {
					assert.ifError(err);
					assert(viewcount > 0);
					done();
				});
			});
		});

		it('should parse about me', function (done) {
			user.setUserFields(fooUid, { picture: '/path/to/picture', aboutme: 'hi i am a bot' }, function (err) {
				assert.ifError(err);
				request(nconf.get('url') + '/api/user/foo', { json: true }, function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert.equal(body.aboutme, 'hi i am a bot');
					assert.equal(body.picture, '/path/to/picture');
					done();
				});
			});
		});

		it('should not return reputation if reputation is disabled', function (done) {
			meta.config['reputation:disabled'] = 1;
			request(nconf.get('url') + '/api/user/foo', { json: true }, function (err, res, body) {
				meta.config['reputation:disabled'] = 0;
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(!body.hasOwnProperty('reputation'));
				done();
			});
		});

		it('should only return posts that are not deleted', function (done) {
			var topicData;
			var pidToDelete;
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
					request(nconf.get('url') + '/api/user/foo', { json: true }, function (err, res, body) {
						assert.ifError(err);
						assert.equal(res.statusCode, 200);
						var contents = body.posts.map(function (p) {
							return p.content;
						});
						assert(!contents.includes('1st reply'));
						done();
					});
				},
			], done);
		});

		it('should return selected group title', function (done) {
			groups.create({
				name: 'selectedGroup',
			}, function (err) {
				assert.ifError(err);
				user.create({ username: 'groupie' }, function (err, uid) {
					assert.ifError(err);
					groups.join('selectedGroup', uid, function (err) {
						assert.ifError(err);
						request(nconf.get('url') + '/api/user/groupie', { json: true }, function (err, res, body) {
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

		it('should 404 if user does not exist', function (done) {
			groups.join('administrators', fooUid, function (err) {
				assert.ifError(err);
				request(nconf.get('url') + '/api/user/doesnotexist/edit', { jar: jar, json: true }, function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 404);
					groups.leave('administrators', fooUid, done);
				});
			});
		});

		it('should render edit/password', function (done) {
			request(nconf.get('url') + '/api/user/foo/edit/password', { jar: jar, json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				done();
			});
		});

		it('should render edit/email', function (done) {
			request(nconf.get('url') + '/api/user/foo/edit/email', { jar: jar, json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				done();
			});
		});

		it('should render edit/username', function (done) {
			request(nconf.get('url') + '/api/user/foo/edit/username', { jar: jar, json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				done();
			});
		});
	});

	describe('account follow page', function () {
		var socketUser = require('../src/socket.io/user');
		var uid;
		before(function (done) {
			user.create({ username: 'follower' }, function (err, _uid) {
				assert.ifError(err);
				uid = _uid;
				socketUser.follow({ uid: uid }, { uid: fooUid }, function (err) {
					assert.ifError(err);
					socketUser.isFollowing({ uid: uid }, { uid: fooUid }, function (err, isFollowing) {
						assert.ifError(err);
						assert(isFollowing);
						done();
					});
				});
			});
		});

		it('should get followers page', function (done) {
			request(nconf.get('url') + '/api/user/foo/followers', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(body.users[0].username, 'follower');
				done();
			});
		});

		it('should get following page', function (done) {
			request(nconf.get('url') + '/api/user/follower/following', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(body.users[0].username, 'foo');
				done();
			});
		});

		it('should return empty after unfollow', function (done) {
			socketUser.unfollow({ uid: uid }, { uid: fooUid }, function (err) {
				assert.ifError(err);
				request(nconf.get('url') + '/api/user/foo/followers', { json: true }, function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert.equal(body.users.length, 0);
					done();
				});
			});
		});
	});

	describe('post redirect', function () {
		var jar;
		before(function (done) {
			helpers.loginUser('foo', 'barbar', function (err, _jar) {
				assert.ifError(err);
				jar = _jar;
				done();
			});
		});

		it('should 404 for invalid pid', function (done) {
			request(nconf.get('url') + '/api/post/fail', function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should 403 if user does not have read privilege', function (done) {
			privileges.categories.rescind(['read'], category.cid, 'registered-users', function (err) {
				assert.ifError(err);
				request(nconf.get('url') + '/api/post/' + pid, { jar: jar }, function (err, res) {
					assert.ifError(err);
					assert.equal(res.statusCode, 403);
					privileges.categories.give(['read'], category.cid, 'registered-users', done);
				});
			});
		});

		it('should return correct post path', function (done) {
			request(nconf.get('url') + '/api/post/' + pid, { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(res.headers['x-redirect'], '/topic/1/test-topic-title/1');
				assert.equal(body, '/topic/1/test-topic-title/1');
				done();
			});
		});
	});

	describe('cookie consent', function () {
		it('should return relevant data in configs API route', function (done) {
			request(nconf.get('url') + '/api/config', function (err, res, body) {
				var parsed;
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

		it('response should be parseable when entries have apostrophes', function (done) {
			meta.configs.set('cookieConsentMessage', 'Julian\'s Message', function (err) {
				assert.ifError(err);

				request(nconf.get('url') + '/api/config', function (err, res, body) {
					var parsed;
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

	it('should return osd data', function (done) {
		request(nconf.get('url') + '/osd.xml', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	describe('handle errors', function () {
		var plugins = require('../src/plugins');
		after(function (done) {
			plugins.loadedHooks['filter:router.page'] = undefined;
			done();
		});

		it('should handle topic malformed uri', function (done) {
			request(nconf.get('url') + '/topic/1/a%AFc', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should handle category malformed uri', function (done) {
			request(nconf.get('url') + '/category/1/a%AFc', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should handle malformed uri ', function (done) {
			request(nconf.get('url') + '/user/a%AFc', function (err, res, body) {
				assert.ifError(err);
				assert(body);
				assert.equal(res.statusCode, 400);
				done();
			});
		});

		it('should handle malformed uri in api', function (done) {
			request(nconf.get('url') + '/api/user/a%AFc', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 400);
				assert.equal(body.error, '[[global:400.title]]');
				done();
			});
		});

		it('should handle CSRF error', function (done) {
			plugins.loadedHooks['filter:router.page'] = plugins.loadedHooks['filter:router.page'] || [];
			plugins.loadedHooks['filter:router.page'].push({
				method: function (req, res, next) {
					var err = new Error('csrf-error');
					err.code = 'EBADCSRFTOKEN';
					next(err);
				},
			});

			request(nconf.get('url') + '/users', { }, function (err, res) {
				plugins.loadedHooks['filter:router.page'] = [];
				assert.ifError(err);
				assert.equal(res.statusCode, 403);
				done();
			});
		});

		it('should handle black-list error', function (done) {
			plugins.loadedHooks['filter:router.page'] = plugins.loadedHooks['filter:router.page'] || [];
			plugins.loadedHooks['filter:router.page'].push({
				method: function (req, res, next) {
					var err = new Error('blacklist error message');
					err.code = 'blacklisted-ip';
					next(err);
				},
			});

			request(nconf.get('url') + '/users', { }, function (err, res, body) {
				plugins.loadedHooks['filter:router.page'] = [];
				assert.ifError(err);
				assert.equal(res.statusCode, 403);
				assert.equal(body, 'blacklist error message');
				done();
			});
		});

		it('should handle page redirect through error', function (done) {
			plugins.loadedHooks['filter:router.page'] = plugins.loadedHooks['filter:router.page'] || [];
			plugins.loadedHooks['filter:router.page'].push({
				method: function (req, res, next) {
					var err = new Error('redirect');
					err.status = 302;
					err.path = '/popular';
					plugins.loadedHooks['filter:router.page'] = [];
					next(err);
				},
			});

			request(nconf.get('url') + '/users', { }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should handle api page redirect through error', function (done) {
			plugins.loadedHooks['filter:router.page'] = plugins.loadedHooks['filter:router.page'] || [];
			plugins.loadedHooks['filter:router.page'].push({
				method: function (req, res, next) {
					var err = new Error('redirect');
					err.status = 308;
					err.path = '/api/popular';
					plugins.loadedHooks['filter:router.page'] = [];
					next(err);
				},
			});

			request(nconf.get('url') + '/api/users', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(res.headers['x-redirect'], '/api/popular');
				assert(body, '/api/popular');
				done();
			});
		});

		it('should handle error page', function (done) {
			plugins.loadedHooks['filter:router.page'] = plugins.loadedHooks['filter:router.page'] || [];
			plugins.loadedHooks['filter:router.page'].push({
				method: function (req, res, next) {
					var err = new Error('regular error');
					next(err);
				},
			});

			request(nconf.get('url') + '/users', function (err, res, body) {
				plugins.loadedHooks['filter:router.page'] = [];
				assert.ifError(err);
				assert.equal(res.statusCode, 500);
				assert(body);
				done();
			});
		});
	});

	describe('timeago locales', function () {
		it('should load timeago locale', function (done) {
			request(nconf.get('url') + '/assets/vendor/jquery/timeago/locales/jquery.timeago.af.js', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body.includes('Afrikaans'));
				done();
			});
		});

		it('should return not found if NodeBB language exists but timeago locale does not exist', function (done) {
			request(nconf.get('url') + '/assets/vendor/jquery/timeago/locales/jquery.timeago.ms.js', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should return not found if NodeBB language does not exist', function (done) {
			request(nconf.get('url') + '/assets/vendor/jquery/timeago/locales/jquery.timeago.muggle.js', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});
	});

	describe('category', function () {
		var jar;
		before(function (done) {
			helpers.loginUser('foo', 'barbar', function (err, _jar) {
				assert.ifError(err);
				jar = _jar;
				done();
			});
		});

		it('should return 404 if cid is not a number', function (done) {
			request(nconf.get('url') + '/api/category/fail', function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should return 404 if topic index is not a number', function (done) {
			request(nconf.get('url') + '/api/category/' + category.slug + '/invalidtopicindex', function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should 404 if category does not exist', function (done) {
			request(nconf.get('url') + '/api/category/123123', function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should 404 if category is disabled', function (done) {
			categories.create({ name: 'disabled' }, function (err, category) {
				assert.ifError(err);
				categories.setCategoryField(category.cid, 'disabled', 1, function (err) {
					assert.ifError(err);
					request(nconf.get('url') + '/api/category/' + category.slug, function (err, res) {
						assert.ifError(err);
						assert.equal(res.statusCode, 404);
						done();
					});
				});
			});
		});

		it('should return 401 if not allowed to read', function (done) {
			categories.create({ name: 'hidden' }, function (err, category) {
				assert.ifError(err);
				privileges.categories.rescind(['read'], category.cid, 'guests', function (err) {
					assert.ifError(err);
					request(nconf.get('url') + '/api/category/' + category.slug, function (err, res) {
						assert.ifError(err);
						assert.equal(res.statusCode, 401);
						done();
					});
				});
			});
		});

		it('should redirect if topic index is negative', function (done) {
			request(nconf.get('url') + '/api/category/' + category.slug + '/-10', function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.ok(res.headers['x-redirect']);
				done();
			});
		});

		it('should 404 if page is not found', function (done) {
			user.setSetting(fooUid, 'usePagination', 1, function (err) {
				assert.ifError(err);
				request(nconf.get('url') + '/api/category/' + category.slug + '?page=100', { jar: jar, json: true }, function (err, res) {
					assert.ifError(err);
					assert.equal(res.statusCode, 404);
					done();
				});
			});
		});

		it('should load page 1 if req.query.page is not sent', function (done) {
			request(nconf.get('url') + '/api/category/' + category.slug, { jar: jar, json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(body.pagination.currentPage, 1);
				done();
			});
		});

		it('should sort topics by most posts', function (done) {
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
							request(nconf.get('url') + '/api/category/' + category.slug + '?sort=most_posts', { jar: jar, json: true }, function (err, res, body) {
								assert.ifError(err);
								assert.equal(res.statusCode, 200);
								assert.equal(body.topics[0].title, 'topic 2');
								assert.equal(body.topics[0].postcount, 2);
								assert.equal(body.topics[1].postcount, 1);
								next();
							});
						},
					], function (err) {
						next(err);
					});
				},
			], done);
		});

		it('should load a specific users topics from a category with tags', function (done) {
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
							request(nconf.get('url') + '/api/category/' + category.slug + '?tag=node&author=foo', { jar: jar, json: true }, function (err, res, body) {
								assert.ifError(err);
								assert.equal(res.statusCode, 200);
								assert.equal(body.topics[0].title, 'topic 2');
								next();
							});
						},
						function (next) {
							request(nconf.get('url') + '/api/category/' + category.slug + '?tag[]=java&tag[]=cpp', { jar: jar, json: true }, function (err, res, body) {
								assert.ifError(err);
								assert.equal(res.statusCode, 200);
								assert.equal(body.topics[0].title, 'topic 3');
								assert.equal(body.topics[1].title, 'topic 1');
								next();
							});
						},
					], function (err) {
						next(err);
					});
				},
			], done);
		});

		it('should redirect if category is a link', function (done) {
			async.waterfall([
				function (next) {
					categories.create({ name: 'redirect', link: 'https://nodebb.org' }, next);
				},
				function (category, next) {
					request(nconf.get('url') + '/api/category/' + category.slug, { jar: jar, json: true }, function (err, res, body) {
						assert.ifError(err);
						assert.equal(res.statusCode, 200);
						assert.equal(res.headers['x-redirect'], 'https://nodebb.org');
						assert.equal(body, 'https://nodebb.org');
						next();
					});
				},
			], done);
		});

		it('should get recent topic replies from children categories', function (done) {
			var parentCategory;
			var childCategory1;
			var childCategory2;

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
							request(nconf.get('url') + '/api/category/' + parentCategory.slug, { jar: jar, json: true }, function (err, res, body) {
								assert.ifError(err);
								assert.equal(res.statusCode, 200);
								assert.equal(body.children[1].posts[0].content, 'topic 1 OP');
								next();
							});
						},
					], function (err) {
						next(err);
					});
				},
			], done);
		});

		it('should create 2 pages of topics', function (done) {
			async.waterfall([
				function (next) {
					categories.create({ name: 'category with 2 pages' }, next);
				},
				function (category, next) {
					var titles = [];
					for (var i = 0; i < 30; i++) {
						titles.push('topic title ' + i);
					}

					async.waterfall([
						function (next) {
							async.eachSeries(titles, function (title, next) {
								topics.post({ uid: fooUid, cid: category.cid, title: title, content: 'does not really matter' }, next);
							}, next);
						},
						function (next) {
							user.getSettings(fooUid, next);
						},
						function (settings, next) {
							request(nconf.get('url') + '/api/category/' + category.slug, { jar: jar, json: true }, function (err, res, body) {
								assert.ifError(err);
								assert.equal(res.statusCode, 200);
								assert.equal(body.topics.length, settings.topicsPerPage);
								assert.equal(body.pagination.pageCount, 2);
								next();
							});
						},
					], function (err) {
						next(err);
					});
				},
			], done);
		});
	});

	describe('unread', function () {
		var jar;
		before(function (done) {
			helpers.loginUser('foo', 'barbar', function (err, _jar) {
				assert.ifError(err);
				jar = _jar;
				done();
			});
		});

		it('should load unread page', function (done) {
			request(nconf.get('url') + '/api/unread', { jar: jar }, function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				done();
			});
		});

		it('should 404 if filter is invalid', function (done) {
			request(nconf.get('url') + '/api/unread/doesnotexist', { jar: jar }, function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should 404 if filter is invalid', function (done) {
			request(nconf.get('url') + '/api/unread/total?filter=doesnotexist', { jar: jar }, function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should return total unread count', function (done) {
			request(nconf.get('url') + '/api/unread/total?filter=new', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(body, 0);
				done();
			});
		});

		it('should redirect if page is out of bounds', function (done) {
			request(nconf.get('url') + '/api/unread?page=-1', { jar: jar, json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(res.headers['x-redirect'], '/unread?page=1');
				assert.equal(body, '/unread?page=1');
				done();
			});
		});
	});

	describe('admin middlewares', function () {
		it('should redirect to login', function (done) {
			request(nconf.get('url') + '//api/admin/advanced/database', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 401);
				done();
			});
		});

		it('should redirect to login', function (done) {
			request(nconf.get('url') + '//admin/advanced/database', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body.includes('Login to your account'));
				done();
			});
		});
	});

	describe('composer', function () {
		var csrf_token;
		var jar;

		before(function (done) {
			helpers.loginUser('foo', 'barbar', function (err, _jar) {
				assert.ifError(err);
				jar = _jar;

				request({
					url: nconf.get('url') + '/api/config',
					json: true,
					jar: jar,
				}, function (err, response, body) {
					assert.ifError(err);
					csrf_token = body.csrf_token;
					done();
				});
			});
		});

		it('should load the composer route', function (done) {
			request(nconf.get('url') + '/api/compose', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body.title);
				assert(body.template);
				assert.equal(body.url, nconf.get('relative_path') + '/compose');
				done();
			});
		});

		it('should load the composer route if disabled by plugin', function (done) {
			function hookMethod(hookData, callback) {
				hookData.templateData.disabled = true;
				callback(null, hookData);
			}

			plugins.registerHook('myTestPlugin', {
				hook: 'filter:composer.build',
				method: hookMethod,
			});

			request(nconf.get('url') + '/api/compose', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body.title);
				assert.strictEqual(body.template.name, '');
				assert.strictEqual(body.url, nconf.get('relative_path') + '/compose');

				plugins.unregisterHook('myTestPlugin', 'filter:composer.build', hookMethod);
				done();
			});
		});

		it('should 404 if plugin calls next', function (done) {
			function hookMethod(hookData, callback) {
				hookData.next();
			}

			plugins.registerHook('myTestPlugin', {
				hook: 'filter:composer.build',
				method: hookMethod,
			});

			request(nconf.get('url') + '/api/compose', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);

				plugins.unregisterHook('myTestPlugin', 'filter:composer.build', hookMethod);
				done();
			});
		});


		it('should error with invalid data', function (done) {
			request.post(nconf.get('url') + '/compose', {
				form: {
					content: 'a new reply',
				},
				jar: jar,
				headers: {
					'x-csrf-token': csrf_token,
				},
			}, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 400);
				request.post(nconf.get('url') + '/compose', {
					form: {
						tid: tid,
					},
					jar: jar,
					headers: {
						'x-csrf-token': csrf_token,
					},
				}, function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 400);
					done();
				});
			});
		});

		it('should create a new topic and reply by composer route', function (done) {
			var data = {
				cid: cid,
				title: 'no js is good',
				content: 'a topic with noscript',
			};
			request.post(nconf.get('url') + '/compose', {
				form: data,
				jar: jar,
				headers: {
					'x-csrf-token': csrf_token,
				},
			}, function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 302);
				request.post(nconf.get('url') + '/compose', {
					form: {
						tid: tid,
						content: 'a new reply',
					},
					jar: jar,
					headers: {
						'x-csrf-token': csrf_token,
					},
				}, function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 302);
					done();
				});
			});
		});
	});

	after(function (done) {
		var analytics = require('../src/analytics');
		analytics.writeData(done);
	});
});

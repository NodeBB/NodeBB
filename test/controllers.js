'use strict';

var async = require('async');
var assert = require('assert');
var nconf = require('nconf');
var request = require('request');

var db = require('./mocks/databasemock');
var categories = require('../src/categories');
var topics = require('../src/topics');
var user = require('../src/user');
var meta = require('../src/meta');
var translator = require('../src/translator');

describe('Controllers', function () {
	var tid;
	var cid;
	var pid;
	var fooUid;

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
			cid = results.category.cid;
			fooUid = results.user;

			topics.post({ uid: results.user, title: 'test topic title', content: 'test topic content', cid: results.category.cid }, function (err, result) {
				tid = result.topicData.tid;
				pid = result.postData.pid;
				done(err);
			});
		});
	});


	it('should load default home route', function (done) {
		request(nconf.get('url'), function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load unread as home route', function (done) {
		meta.config.homePageRoute = 'unread';
		request(nconf.get('url'), function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load recent as home route', function (done) {
		meta.config.homePageRoute = 'recent';
		request(nconf.get('url'), function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load popular as home route', function (done) {
		meta.config.homePageRoute = 'popular';
		request(nconf.get('url'), function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load category as home route', function (done) {
		meta.config.homePageRoute = 'category/1/test-category';
		request(nconf.get('url'), function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
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
		var plugins = require('../src/plugins');
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
		request(nconf.get('url') + '/outgoing?url=http//youtube.com', function (err, res, body) {
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

	it('should load recent rss feed', function (done) {
		request(nconf.get('url') + '/recent.rss', function (err, res, body) {
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
		request(nconf.get('url') + '/stylesheet.css', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load admin.css', function (done) {
		request(nconf.get('url') + '/admin.css', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});


	it('should load nodebb.min.js', function (done) {
		request(nconf.get('url') + '/nodebb.min.js', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load acp.min.js', function (done) {
		request(nconf.get('url') + '/acp.min.js', function (err, res, body) {
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

	it('should load users search page', function (done) {
		request(nconf.get('url') + '/users?term=bar&section=sort-posts', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
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
		var groups = require('../src/groups');
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
		var helpers = require('./helpers');
		before(function (done) {
			user.create({ username: 'revokeme', password: 'barbar' }, function (err, _uid) {
				assert.ifError(err);
				uid = _uid;
				helpers.loginUser('revokeme', 'barbar', function (err, _jar, io, _csrf_token) {
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
				assert.equal(body, '{"path":"/user/doesnotexist/session/1112233","loggedIn":true,"title":"[[global:403.title]]"}');
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

		it('should return {} if there is no template or locations', function (done) {
			request(nconf.get('url') + '/api/widgets/render', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				assert.equal(Object.keys(body), 0);
				done();
			});
		});

		it('should render templates', function (done) {
			var url = nconf.get('url') + '/api/widgets/render?template=categories.tpl&url=&isMobile=false&locations%5B%5D=sidebar&locations%5B%5D=footer&locations%5B%5D=header';
			request(url, { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
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
		var helpers = require('./helpers');
		var jar;
		before(function (done) {
			helpers.loginUser('foo', 'barbar', function (err, _jar) {
				assert.ifError(err);
				jar = _jar;
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

		it('should load /user/foo/topics', function (done) {
			request(nconf.get('url') + '/api/user/foo/topics', function (err, res, body) {
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
		it('should 404 for invalid pid', function (done) {
			request(nconf.get('url') + '/api/post/fail', function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});

		it('should return correct post path', function (done) {
			request(nconf.get('url') + '/api/post/' + pid, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 308);
				assert.equal(body, '"/topic/1/test-topic-title/1"');
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
				assert(body);
				done();
			});
		});

		it('should handle category malformed uri', function (done) {
			request(nconf.get('url') + '/category/1/a%AFc', function (err, res, body) {
				assert.ifError(err);
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

			request(nconf.get('url') + '/users', { }, function (err, res, body) {
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
				assert.equal(res.statusCode, 308);
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


	after(function (done) {
		var analytics = require('../src/analytics');
		analytics.writeData(function (err) {
			assert.ifError(err);
			db.emptydb(done);
		});
	});
});

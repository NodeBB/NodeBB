'use strict';

var async = require('async');
var	assert = require('assert');
var nconf = require('nconf');
var request = require('request');

var db = require('./mocks/databasemock');
var categories = require('../src/categories');
var topics = require('../src/topics');
var user = require('../src/user');
var groups = require('../src/groups');
var helpers = require('./helpers');
var meta = require('../src/meta');

describe('Admin Controllers', function () {
	var tid;
	var cid;
	var pid;
	var adminUid;
	var regularUid;
	var moderatorUid;
	var jar;

	before(function (done) {
		async.series({
			category: function (next) {
				categories.create({
					name: 'Test Category',
					description: 'Test category created by testing script',
				}, next);
			},
			adminUid: function (next) {
				user.create({ username: 'admin', password: 'barbar' }, next);
			},
			regularUid: function (next) {
				user.create({ username: 'regular' }, next);
			},
			moderatorUid: function (next) {
				user.create({ username: 'moderator', password: 'modmod' }, next);
			},
		}, function (err, results) {
			if (err) {
				return done(err);
			}
			adminUid = results.adminUid;
			regularUid = results.regularUid;
			moderatorUid = results.moderatorUid;
			cid = results.category.cid;

			topics.post({ uid: adminUid, title: 'test topic title', content: 'test topic content', cid: results.category.cid }, function (err, result) {
				assert.ifError(err);
				tid = result.topicData.tid;
				pid = result.postData.pid;
				done();
			});
		});
	});

	it('should 403 if user is not admin', function (done) {
		helpers.loginUser('admin', 'barbar', function (err, _jar) {
			assert.ifError(err);
			jar = _jar;
			request(nconf.get('url') + '/admin', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 403);
				assert(body);
				done();
			});
		});
	});

	it('should load admin dashboard', function (done) {
		groups.join('administrators', adminUid, function (err) {
			assert.ifError(err);
			request(nconf.get('url') + '/admin', { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});
	});

	it('should load groups page', function (done) {
		request(nconf.get('url') + '/admin/manage/groups', { jar: jar }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load groups detail page', function (done) {
		request(nconf.get('url') + '/admin/manage/groups/administrators', { jar: jar }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load global privileges page', function (done) {
		request(nconf.get('url') + '/admin/manage/privileges', { jar: jar }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load privileges page for category 1', function (done) {
		request(nconf.get('url') + '/admin/manage/privileges/1', { jar: jar }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load manage uploads', function (done) {
		request(nconf.get('url') + '/admin/manage/uploads', { jar: jar }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load general settings page', function (done) {
		request(nconf.get('url') + '/admin/settings', { jar: jar }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load email settings page', function (done) {
		request(nconf.get('url') + '/admin/settings/email', { jar: jar }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load user settings page', function (done) {
		request(nconf.get('url') + '/admin/settings/user', { jar: jar }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load info page for a user', function (done) {
		request(nconf.get('url') + '/api/user/regular/info', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body.history);
			assert(Array.isArray(body.history.flags));
			assert(Array.isArray(body.history.bans));
			assert(Array.isArray(body.sessions));
			done();
		});
	});

	it('should 404 for edit/email page if user does not exist', function (done) {
		request(nconf.get('url') + '/api/user/doesnotexist/edit/email', { jar: jar, json: true }, function (err, res) {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			done();
		});
	});

	it('should load /admin/general/homepage', function (done) {
		request(nconf.get('url') + '/api/admin/general/homepage', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body.routes);
			done();
		});
	});

	it('should load /admin/advanced/database', function (done) {
		request(nconf.get('url') + '/api/admin/advanced/database', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);

			if (nconf.get('redis')) {
				assert(body.redis);
			} else if (nconf.get('mongo')) {
				assert(body.mongo);
			} else if (nconf.get('postgres')) {
				assert(body.postgres);
			}
			done();
		});
	});

	it('should load /admin/extend/plugins', function (done) {
		request(nconf.get('url') + '/api/admin/extend/plugins', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert(body.hasOwnProperty('installed'));
			assert(body.hasOwnProperty('upgradeCount'));
			assert(body.hasOwnProperty('download'));
			assert(body.hasOwnProperty('incompatible'));
			done();
		});
	});

	it('should load /admin/manage/users', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/users/search', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users/search', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body.users);
			done();
		});
	});

	it('should load /admin/manage/users/not-validated', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users/not-validated', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/users/no-posts', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users/no-posts', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/users/top-posters', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users/top-posters', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/users/most-reputation', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users/most-reputation', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/users/inactive', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users/inactive', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/users/flagged', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users/flagged', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/users/banned', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users/banned', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/registration', function (done) {
		request(nconf.get('url') + '/api/admin/manage/registration', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should 404 if users is not privileged', function (done) {
		request(nconf.get('url') + '/api/registration-queue', { json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			assert(body);
			done();
		});
	});

	it('should load /api/registration-queue', function (done) {
		request(nconf.get('url') + '/api/registration-queue', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/admins-mods', function (done) {
		request(nconf.get('url') + '/api/admin/manage/admins-mods', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should return 403 if no referer', function (done) {
		request(nconf.get('url') + '/api/admin/users/csv', { jar: jar }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 403);
			assert.equal(body, '[[error:invalid-origin]]');
			done();
		});
	});

	it('should return 403 if referer is not /admin/users/csv', function (done) {
		request(nconf.get('url') + '/api/admin/users/csv', {
			jar: jar,
			headers: {
				referer: '/topic/1/test',
			},
		}, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 403);
			assert.equal(body, '[[error:invalid-origin]]');
			done();
		});
	});

	it('should load /admin/users/csv', function (done) {
		request(nconf.get('url') + '/api/admin/users/csv', {
			jar: jar,
			headers: {
				referer: nconf.get('url') + '/admin/manage/users',
			},
		}, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/advanced/hooks', function (done) {
		request(nconf.get('url') + '/api/admin/advanced/hooks', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/advanced/cache', function (done) {
		request(nconf.get('url') + '/api/admin/advanced/cache', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/advanced/errors', function (done) {
		request(nconf.get('url') + '/api/admin/advanced/errors', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/advanced/errors/export', function (done) {
		request(nconf.get('url') + '/api/admin/advanced/errors/export', { jar: jar }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/advanced/logs', function (done) {
		var fs = require('fs');
		fs.appendFile(meta.logs.path, 'dummy log', function (err) {
			assert.ifError(err);
			request(nconf.get('url') + '/api/admin/advanced/logs', { jar: jar, json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});
	});

	it('should load /admin/general/navigation', function (done) {
		var navigation = require('../src/navigation/admin');
		var data = require('../install/data/navigation.json');

		navigation.save(data, function (err) {
			assert.ifError(err);
			request(nconf.get('url') + '/api/admin/general/navigation', { jar: jar, json: true }, function (err, res, body) {
				assert.ifError(err);
				assert(body);
				assert(body.available);
				assert(body.enabled);
				done();
			});
		});
	});

	it('should load /admin/development/info', function (done) {
		request(nconf.get('url') + '/api/admin/development/info', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/development/logger', function (done) {
		request(nconf.get('url') + '/api/admin/development/logger', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/advanced/events', function (done) {
		request(nconf.get('url') + '/api/admin/advanced/events', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/general/sounds', function (done) {
		request(nconf.get('url') + '/api/admin/general/sounds', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/categories', function (done) {
		request(nconf.get('url') + '/api/admin/manage/categories', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/categories/1', function (done) {
		request(nconf.get('url') + '/api/admin/manage/categories/1', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/categories/1/analytics', function (done) {
		request(nconf.get('url') + '/api/admin/manage/categories/1/analytics', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/extend/rewards', function (done) {
		request(nconf.get('url') + '/api/admin/extend/rewards', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/extend/widgets', function (done) {
		request(nconf.get('url') + '/api/admin/extend/widgets', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/general/languages', function (done) {
		request(nconf.get('url') + '/api/admin/general/languages', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/general/social', function (done) {
		var socketAdmin = require('../src/socket.io/admin');
		socketAdmin.social.savePostSharingNetworks({ uid: adminUid }, ['facebook', 'twitter', 'google'], function (err) {
			assert.ifError(err);
			request(nconf.get('url') + '/api/admin/general/social', { jar: jar, json: true }, function (err, res, body) {
				assert.ifError(err);
				assert(body);
				body = body.posts.map(function (network) {
					return network && network.id;
				});
				assert(body.includes('facebook'));
				assert(body.includes('twitter'));
				assert(body.includes('google'));
				done();
			});
		});
	});

	it('should load /admin/manage/tags', function (done) {
		request(nconf.get('url') + '/api/admin/manage/tags', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/post-queue', function (done) {
		request(nconf.get('url') + '/api/admin/manage/post-queue', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('/post-queue should 404 for regular user', function (done) {
		request(nconf.get('url') + '/api/post-queue', { json: true }, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			assert.equal(res.statusCode, 404);
			done();
		});
	});

	it('should load /post-queue', function (done) {
		request(nconf.get('url') + '/api/post-queue', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/ip-blacklist', function (done) {
		request(nconf.get('url') + '/api/admin/manage/ip-blacklist', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('/ip-blacklist should 404 for regular user', function (done) {
		request(nconf.get('url') + '/api/ip-blacklist', { json: true }, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			assert.equal(res.statusCode, 404);
			done();
		});
	});

	it('should load /ip-blacklist', function (done) {
		request(nconf.get('url') + '/api/ip-blacklist', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/appearance/themes', function (done) {
		request(nconf.get('url') + '/api/admin/appearance/themes', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/appearance/customise', function (done) {
		request(nconf.get('url') + '/api/admin/appearance/customise', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /recent in maintenance mode', function (done) {
		meta.config.maintenanceMode = 1;
		request(nconf.get('url') + '/api/recent', { jar: jar, json: true }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			meta.config.maintenanceMode = 0;
			done();
		});
	});

	describe('mods page', function () {
		var moderatorJar;

		before(function (done) {
			helpers.loginUser('moderator', 'modmod', function (err, _jar) {
				assert.ifError(err);
				moderatorJar = _jar;

				groups.join('cid:' + cid + ':privileges:moderate', moderatorUid, done);
			});
		});

		it('should error with no privileges', function (done) {
			request(nconf.get('url') + '/api/flags', { json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(body.error, '[[error:no-privileges]]');
				done();
			});
		});

		it('should load flags page data', function (done) {
			request(nconf.get('url') + '/api/flags', { jar: moderatorJar, json: true }, function (err, res, body) {
				assert.ifError(err);
				assert(body);
				assert(body.flags);
				assert(body.categories);
				assert(body.filters);
				assert.equal(body.categories[cid], 'Test Category');
				assert.equal(body.filters.cid.indexOf(cid), -1);
				done();
			});
		});

		it('should return invalid data if flag does not exist', function (done) {
			request(nconf.get('url') + '/api/flags/123123123', { jar: moderatorJar, json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(body.error, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error with not enough reputation to flag', function (done) {
			var socketFlags = require('../src/socket.io/flags');
			var oldValue = meta.config['min:rep:flag'];
			meta.config['min:rep:flag'] = 1000;
			socketFlags.create({ uid: regularUid }, { id: pid, type: 'post', reason: 'spam' }, function (err) {
				assert.equal(err.message, '[[error:not-enough-reputation-to-flag]]');
				meta.config['min:rep:flag'] = oldValue;
				done();
			});
		});

		it('should return flag details', function (done) {
			var socketFlags = require('../src/socket.io/flags');
			var oldValue = meta.config['min:rep:flag'];
			meta.config['min:rep:flag'] = 0;
			socketFlags.create({ uid: regularUid }, { id: pid, type: 'post', reason: 'spam' }, function (err, data) {
				meta.config['min:rep:flag'] = oldValue;
				assert.ifError(err);
				request(nconf.get('url') + '/api/flags/' + data.flagId, { jar: moderatorJar, json: true }, function (err, res, body) {
					assert.ifError(err);
					assert(body);
					assert.equal(body.reporter.username, 'regular');
					done();
				});
			});
		});
	});

	it('should escape special characters in config', function (done) {
		var plugins = require('../src/plugins');
		function onConfigGet(config, callback) {
			config.someValue = '"foo"';
			config.otherValue = "'123'";
			config.script = '</script>';
			callback(null, config);
		}
		plugins.registerHook('somePlugin', { hook: 'filter:config.get', method: onConfigGet });
		request(nconf.get('url') + '/admin', { jar: jar }, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			assert(body.includes('"someValue":"\\\\"foo\\\\""'));
			assert(body.includes('"otherValue":"\\\'123\\\'"'));
			assert(body.includes('"script":"<\\/script>"'));
			request(nconf.get('url'), { jar: jar }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				assert(body.includes('"someValue":"\\\\"foo\\\\""'));
				assert(body.includes('"otherValue":"\\\'123\\\'"'));
				assert(body.includes('"script":"<\\/script>"'));
				plugins.unregisterHook('somePlugin', 'filter:config.get', onConfigGet);
				done();
			});
		});
	});
});

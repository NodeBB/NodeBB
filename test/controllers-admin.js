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

describe('Admin Controllers', () => {
	var tid;
	var cid;
	var pid;
	let regularPid;
	var adminUid;
	var regularUid;
	let regular2Uid;
	var moderatorUid;
	var jar;

	before((done) => {
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
			regular2Uid: function (next) {
				user.create({ username: 'regular2' }, next);
			},
			moderatorUid: function (next) {
				user.create({ username: 'moderator', password: 'modmod' }, next);
			},
		}, async (err, results) => {
			if (err) {
				return done(err);
			}
			adminUid = results.adminUid;
			regularUid = results.regularUid;
			regular2Uid = results.regular2Uid;
			moderatorUid = results.moderatorUid;
			cid = results.category.cid;

			const adminPost = await topics.post({ uid: adminUid, title: 'test topic title', content: 'test topic content', cid: results.category.cid });
			assert.ifError(err);
			tid = adminPost.topicData.tid;
			pid = adminPost.postData.pid;

			const regularPost = await topics.post({ uid: regular2Uid, title: 'regular user\'s test topic title', content: 'test topic content', cid: results.category.cid });
			regularPid = regularPost.postData.pid;
			done();
		});
	});

	it('should 403 if user is not admin', (done) => {
		helpers.loginUser('admin', 'barbar', (err, _jar) => {
			assert.ifError(err);
			jar = _jar;
			request(`${nconf.get('url')}/admin`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 403);
				assert(body);
				done();
			});
		});
	});

	it('should load admin dashboard', (done) => {
		groups.join('administrators', adminUid, (err) => {
			assert.ifError(err);
			request(`${nconf.get('url')}/admin`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});
	});

	it('should load groups page', (done) => {
		request(`${nconf.get('url')}/admin/manage/groups`, { jar: jar }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load groups detail page', (done) => {
		request(`${nconf.get('url')}/admin/manage/groups/administrators`, { jar: jar }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load global privileges page', (done) => {
		request(`${nconf.get('url')}/admin/manage/privileges`, { jar: jar }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load privileges page for category 1', (done) => {
		request(`${nconf.get('url')}/admin/manage/privileges/1`, { jar: jar }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load manage uploads', (done) => {
		request(`${nconf.get('url')}/admin/manage/uploads`, { jar: jar }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load general settings page', (done) => {
		request(`${nconf.get('url')}/admin/settings`, { jar: jar }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load email settings page', (done) => {
		request(`${nconf.get('url')}/admin/settings/email`, { jar: jar }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load user settings page', (done) => {
		request(`${nconf.get('url')}/admin/settings/user`, { jar: jar }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load info page for a user', (done) => {
		request(`${nconf.get('url')}/api/user/regular/info`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body.history);
			assert(Array.isArray(body.history.flags));
			assert(Array.isArray(body.history.bans));
			assert(Array.isArray(body.sessions));
			done();
		});
	});

	it('should 404 for edit/email page if user does not exist', (done) => {
		request(`${nconf.get('url')}/api/user/doesnotexist/edit/email`, { jar: jar, json: true }, (err, res) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			done();
		});
	});

	it('should load /admin/settings/homepage', (done) => {
		request(`${nconf.get('url')}/api/admin/settings/homepage`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body.routes);
			done();
		});
	});

	it('should load /admin/advanced/database', (done) => {
		request(`${nconf.get('url')}/api/admin/advanced/database`, { jar: jar, json: true }, (err, res, body) => {
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

	it('should load /admin/extend/plugins', (done) => {
		request(`${nconf.get('url')}/api/admin/extend/plugins`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert(body.hasOwnProperty('installed'));
			assert(body.hasOwnProperty('upgradeCount'));
			assert(body.hasOwnProperty('download'));
			assert(body.hasOwnProperty('incompatible'));
			done();
		});
	});

	it('should load /admin/manage/users', (done) => {
		request(`${nconf.get('url')}/api/admin/manage/users`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/registration', (done) => {
		request(`${nconf.get('url')}/api/admin/manage/registration`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should 404 if users is not privileged', (done) => {
		request(`${nconf.get('url')}/api/registration-queue`, { json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			assert(body);
			done();
		});
	});

	it('should load /api/registration-queue', (done) => {
		request(`${nconf.get('url')}/api/registration-queue`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/admins-mods', (done) => {
		request(`${nconf.get('url')}/api/admin/manage/admins-mods`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/users/csv', (done) => {
		const socketAdmin = require('../src/socket.io/admin');
		socketAdmin.user.exportUsersCSV({ uid: adminUid }, {}, (err) => {
			assert.ifError(err);
			setTimeout(() => {
				request(`${nconf.get('url')}/api/admin/users/csv`, {
					jar: jar,
					headers: {
						referer: `${nconf.get('url')}/admin/manage/users`,
					},
				}, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body);
					done();
				});
			}, 2000);
		});
	});

	it('should return 403 if no referer', (done) => {
		request(`${nconf.get('url')}/api/admin/groups/administrators/csv`, { jar: jar }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 403);
			assert.equal(body, '[[error:invalid-origin]]');
			done();
		});
	});

	it('should return 403 if referer is not /api/admin/groups/administrators/csv', (done) => {
		request(`${nconf.get('url')}/api/admin/groups/administrators/csv`, {
			jar: jar,
			headers: {
				referer: '/topic/1/test',
			},
		}, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 403);
			assert.equal(body, '[[error:invalid-origin]]');
			done();
		});
	});

	it('should load /api/admin/groups/administrators/csv', (done) => {
		request(`${nconf.get('url')}/api/admin/groups/administrators/csv`, {
			jar: jar,
			headers: {
				referer: `${nconf.get('url')}/admin/manage/groups`,
			},
		}, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/advanced/hooks', (done) => {
		request(`${nconf.get('url')}/api/admin/advanced/hooks`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/advanced/cache', (done) => {
		request(`${nconf.get('url')}/api/admin/advanced/cache`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/advanced/errors', (done) => {
		request(`${nconf.get('url')}/api/admin/advanced/errors`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/advanced/errors/export', (done) => {
		meta.errors.clear((err) => {
			assert.ifError(err);
			request(`${nconf.get('url')}/api/admin/advanced/errors/export`, { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.strictEqual(body, '');
				done();
			});
		});
	});

	it('should load /admin/advanced/logs', (done) => {
		var fs = require('fs');
		fs.appendFile(meta.logs.path, 'dummy log', (err) => {
			assert.ifError(err);
			request(`${nconf.get('url')}/api/admin/advanced/logs`, { jar: jar, json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});
	});

	it('should load /admin/settings/navigation', (done) => {
		var navigation = require('../src/navigation/admin');
		var data = require('../install/data/navigation.json');

		navigation.save(data, (err) => {
			assert.ifError(err);
			request(`${nconf.get('url')}/api/admin/settings/navigation`, { jar: jar, json: true }, (err, res, body) => {
				assert.ifError(err);
				assert(body);
				assert(body.available);
				assert(body.enabled);
				done();
			});
		});
	});

	it('should load /admin/development/info', (done) => {
		request(`${nconf.get('url')}/api/admin/development/info`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/development/logger', (done) => {
		request(`${nconf.get('url')}/api/admin/development/logger`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/advanced/events', (done) => {
		request(`${nconf.get('url')}/api/admin/advanced/events`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/categories', (done) => {
		request(`${nconf.get('url')}/api/admin/manage/categories`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/categories/1', (done) => {
		request(`${nconf.get('url')}/api/admin/manage/categories/1`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/categories/1/analytics', (done) => {
		request(`${nconf.get('url')}/api/admin/manage/categories/1/analytics`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/extend/rewards', (done) => {
		request(`${nconf.get('url')}/api/admin/extend/rewards`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/extend/widgets', (done) => {
		request(`${nconf.get('url')}/api/admin/extend/widgets`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/settings/languages', (done) => {
		request(`${nconf.get('url')}/api/admin/settings/languages`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/settings/social', (done) => {
		var socketAdmin = require('../src/socket.io/admin');
		socketAdmin.social.savePostSharingNetworks({ uid: adminUid }, ['facebook', 'twitter'], (err) => {
			assert.ifError(err);
			request(`${nconf.get('url')}/api/admin/settings/social`, { jar: jar, json: true }, (err, res, body) => {
				assert.ifError(err);
				assert(body);
				body = body.posts.map(network => network && network.id);
				assert(body.includes('facebook'));
				assert(body.includes('twitter'));
				done();
			});
		});
	});

	it('should load /admin/manage/tags', (done) => {
		request(`${nconf.get('url')}/api/admin/manage/tags`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('/post-queue should 404 for regular user', (done) => {
		request(`${nconf.get('url')}/api/post-queue`, { json: true }, (err, res, body) => {
			assert.ifError(err);
			assert(body);
			assert.equal(res.statusCode, 404);
			done();
		});
	});

	it('should load /post-queue', (done) => {
		request(`${nconf.get('url')}/api/post-queue`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('/ip-blacklist should 404 for regular user', (done) => {
		request(`${nconf.get('url')}/api/ip-blacklist`, { json: true }, (err, res, body) => {
			assert.ifError(err);
			assert(body);
			assert.equal(res.statusCode, 404);
			done();
		});
	});

	it('should load /ip-blacklist', (done) => {
		request(`${nconf.get('url')}/api/ip-blacklist`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/appearance/themes', (done) => {
		request(`${nconf.get('url')}/api/admin/appearance/themes`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /admin/appearance/customise', (done) => {
		request(`${nconf.get('url')}/api/admin/appearance/customise`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /recent in maintenance mode', (done) => {
		meta.config.maintenanceMode = 1;
		request(`${nconf.get('url')}/api/recent`, { jar: jar, json: true }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			meta.config.maintenanceMode = 0;
			done();
		});
	});

	describe('mods page', () => {
		var moderatorJar;

		before((done) => {
			helpers.loginUser('moderator', 'modmod', (err, _jar) => {
				assert.ifError(err);
				moderatorJar = _jar;

				groups.join(`cid:${cid}:privileges:moderate`, moderatorUid, done);
			});
		});

		it('should error with no privileges', (done) => {
			request(`${nconf.get('url')}/api/flags`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(body.error, '[[error:no-privileges]]');
				done();
			});
		});

		it('should load flags page data', (done) => {
			request(`${nconf.get('url')}/api/flags`, { jar: moderatorJar, json: true }, (err, res, body) => {
				assert.ifError(err);
				assert(body);
				assert(body.flags);
				assert(body.filters);
				assert.equal(body.filters.cid.indexOf(cid), -1);
				done();
			});
		});

		it('should return invalid data if flag does not exist', (done) => {
			request(`${nconf.get('url')}/api/flags/123123123`, { jar: moderatorJar, json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(body.error, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error when you attempt to flag a privileged user\'s post', async () => {
			var socketFlags = require('../src/socket.io/flags');
			var oldValue = meta.config['min:rep:flag'];
			try {
				await socketFlags.create({ uid: regularUid }, { id: pid, type: 'post', reason: 'spam' });
			} catch (err) {
				assert.strictEqual(err.message, '[[error:cant-flag-privileged]]');
			}
		});

		it('should error with not enough reputation to flag', (done) => {
			var socketFlags = require('../src/socket.io/flags');
			var oldValue = meta.config['min:rep:flag'];
			meta.config['min:rep:flag'] = 1000;
			socketFlags.create({ uid: regularUid }, { id: regularPid, type: 'post', reason: 'spam' }, (err) => {
				assert.strictEqual(err.message, '[[error:not-enough-reputation-to-flag]]');
				meta.config['min:rep:flag'] = oldValue;
				done();
			});
		});

		it('should return flag details', (done) => {
			var socketFlags = require('../src/socket.io/flags');
			var oldValue = meta.config['min:rep:flag'];
			meta.config['min:rep:flag'] = 0;
			socketFlags.create({ uid: regularUid }, { id: regularPid, type: 'post', reason: 'spam' }, (err, flagId) => {
				meta.config['min:rep:flag'] = oldValue;
				assert.ifError(err);
				request(`${nconf.get('url')}/api/flags/${flagId}`, { jar: moderatorJar, json: true }, (err, res, body) => {
					assert.ifError(err);
					assert(body);
					assert(body.reports);
					assert(Array.isArray(body.reports));
					assert.strictEqual(body.reports[0].reporter.username, 'regular');
					done();
				});
			});
		});
	});

	it('should escape special characters in config', (done) => {
		var plugins = require('../src/plugins');
		function onConfigGet(config, callback) {
			config.someValue = '"foo"';
			config.otherValue = "'123'";
			config.script = '</script>';
			callback(null, config);
		}
		plugins.hooks.register('somePlugin', { hook: 'filter:config.get', method: onConfigGet });
		request(`${nconf.get('url')}/admin`, { jar: jar }, (err, res, body) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			assert(body.includes('"someValue":"\\\\"foo\\\\""'));
			assert(body.includes('"otherValue":"\\\'123\\\'"'));
			assert(body.includes('"script":"<\\/script>"'));
			request(nconf.get('url'), { jar: jar }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				assert(body.includes('"someValue":"\\\\"foo\\\\""'));
				assert(body.includes('"otherValue":"\\\'123\\\'"'));
				assert(body.includes('"script":"<\\/script>"'));
				plugins.hooks.unregister('somePlugin', 'filter:config.get', onConfigGet);
				done();
			});
		});
	});
});

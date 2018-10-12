'use strict';

// see https://gist.github.com/jfromaniello/4087861#gistcomment-1447029


process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var assert = require('assert');
var async = require('async');
var nconf = require('nconf');
var request = require('request');
var cookies = request.jar();

var db = require('./mocks/databasemock');
var user = require('../src/user');
var groups = require('../src/groups');
var categories = require('../src/categories');
var helpers = require('./helpers');
var meta = require('../src/meta');

var socketAdmin = require('../src/socket.io/admin');

describe('socket.io', function () {
	var io;
	var cid;
	var tid;
	var adminUid;
	var regularUid;

	before(function (done) {
		async.series([
			async.apply(user.create, { username: 'admin', password: 'adminpwd' }),
			async.apply(user.create, { username: 'regular', password: 'regularpwd', email: 'regular@test.com' }),
			async.apply(categories.create, {
				name: 'Test Category',
				description: 'Test category created by testing script',
			}),
		], function (err, data) {
			if (err) {
				return done(err);
			}
			adminUid = data[0];
			regularUid = data[1];
			cid = data[2].cid;

			groups.join('administrators', data[0], done);
		});
	});


	it('should connect and auth properly', function (done) {
		request.get({
			url: nconf.get('url') + '/api/config',
			jar: cookies,
			json: true,
		}, function (err, res, body) {
			assert.ifError(err);

			request.post(nconf.get('url') + '/login', {
				jar: cookies,
				form: {
					username: 'admin',
					password: 'adminpwd',
				},
				headers: {
					'x-csrf-token': body.csrf_token,
				},
				json: true,
			}, function (err, res) {
				assert.ifError(err);

				helpers.connectSocketIO(res, function (err, _io) {
					io = _io;
					assert.ifError(err);

					done();
				});
			});
		});
	});

	it('should return error for unknown event', function (done) {
		io.emit('unknown.event', function (err) {
			assert(err);
			assert.equal(err.message, '[[error:invalid-event]]');
			done();
		});
	});

	it('should get installed themes', function (done) {
		var themes = ['nodebb-theme-lavender', 'nodebb-theme-persona', 'nodebb-theme-vanilla'];
		io.emit('admin.themes.getInstalled', function (err, data) {
			assert.ifError(err);
			assert(data);
			var installed = data.map(function (theme) {
				return theme.id;
			});
			themes.forEach(function (theme) {
				assert.notEqual(installed.indexOf(theme), -1);
			});
			done();
		});
	});

	it('should post a topic', function (done) {
		io.emit('topics.post', { title: 'test topic title', content: 'test topic main post content', uid: adminUid, cid: cid }, function (err, result) {
			assert.ifError(err);
			assert.equal(result.user.username, 'admin');
			assert.equal(result.category.cid, cid);
			assert.equal(result.mainPost.content, 'test topic main post content');
			tid = result.tid;
			done();
		});
	});

	it('should reply to topic', function (done) {
		io.emit('posts.reply', { tid: tid, uid: adminUid, content: 'test post content' }, function (err, result) {
			assert.ifError(err);
			assert.equal(result.uid, adminUid);
			assert.equal(result.user.username, 'admin');
			assert.equal(result.topic.tid, tid);
			done();
		});
	});

	it('should ban a user', function (done) {
		var socketUser = require('../src/socket.io/user');
		socketUser.banUsers({ uid: adminUid }, { uids: [regularUid], reason: 'spammer' }, function (err) {
			assert.ifError(err);
			user.getLatestBanInfo(regularUid, function (err, data) {
				assert.ifError(err);
				assert(data.uid);
				assert(data.timestamp);
				assert(data.hasOwnProperty('expiry'));
				assert(data.hasOwnProperty('expiry_readable'));
				assert.equal(data.reason, 'spammer');
				done();
			});
		});
	});

	it('should return ban reason', function (done) {
		user.getBannedReason(regularUid, function (err, reason) {
			assert.ifError(err);
			assert.equal(reason, 'spammer');
			done();
		});
	});

	it('should unban a user', function (done) {
		var socketUser = require('../src/socket.io/user');
		socketUser.unbanUsers({ uid: adminUid }, [regularUid], function (err) {
			assert.ifError(err);
			user.isBanned(regularUid, function (err, isBanned) {
				assert.ifError(err);
				assert(!isBanned);
				done();
			});
		});
	});

	it('should make user admin', function (done) {
		socketAdmin.user.makeAdmins({ uid: adminUid }, [regularUid], function (err) {
			assert.ifError(err);
			groups.isMember(regularUid, 'administrators', function (err, isMember) {
				assert.ifError(err);
				assert(isMember);
				done();
			});
		});
	});

	it('should make user non-admin', function (done) {
		socketAdmin.user.removeAdmins({ uid: adminUid }, [regularUid], function (err) {
			assert.ifError(err);
			groups.isMember(regularUid, 'administrators', function (err, isMember) {
				assert.ifError(err);
				assert(!isMember);
				done();
			});
		});
	});

	describe('create/delete', function () {
		var uid;
		it('should create a user', function (done) {
			socketAdmin.user.createUser({ uid: adminUid }, { username: 'foo1' }, function (err, _uid) {
				assert.ifError(err);
				uid = _uid;
				groups.isMember(uid, 'registered-users', function (err, isMember) {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			});
		});

		it('should delete users', function (done) {
			socketAdmin.user.deleteUsers({ uid: adminUid }, [uid], function (err) {
				assert.ifError(err);
				setTimeout(function () {
					groups.isMember(uid, 'registered-users', function (err, isMember) {
						assert.ifError(err);
						assert(!isMember);
						done();
					});
				}, 500);
			});
		});

		it('should delete users and their content', function (done) {
			socketAdmin.user.deleteUsersAndContent({ uid: adminUid }, [uid], function (err) {
				assert.ifError(err);
				done();
			});
		});
	});

	it('should error with invalid data', function (done) {
		socketAdmin.user.createUser({ uid: adminUid }, null, function (err) {
			assert.equal(err.message, '[[error:invalid-data]]');
			done();
		});
	});

	it('should reset lockouts', function (done) {
		socketAdmin.user.resetLockouts({ uid: adminUid }, [regularUid], function (err) {
			assert.ifError(err);
			done();
		});
	});

	describe('validation emails', function () {
		var meta = require('../src/meta');

		it('should validate emails', function (done) {
			socketAdmin.user.validateEmail({ uid: adminUid }, [regularUid], function (err) {
				assert.ifError(err);
				user.getUserField(regularUid, 'email:confirmed', function (err, emailConfirmed) {
					assert.ifError(err);
					assert.equal(parseInt(emailConfirmed, 10), 1);
					done();
				});
			});
		});

		it('should error with invalid uids', function (done) {
			socketAdmin.user.sendValidationEmail({ uid: adminUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error if email validation is not required', function (done) {
			socketAdmin.user.sendValidationEmail({ uid: adminUid }, [regularUid], function (err) {
				assert.equal(err.message, '[[error:email-confirmations-are-disabled]]');
				done();
			});
		});

		it('should send validation email', function (done) {
			meta.config.requireEmailConfirmation = 1;
			socketAdmin.user.sendValidationEmail({ uid: adminUid }, [regularUid], function (err) {
				assert.ifError(err);
				meta.config.requireEmailConfirmation = 0;
				done();
			});
		});
	});

	it('should search users', function (done) {
		socketAdmin.user.search({ uid: adminUid }, { query: 'reg', searchBy: 'username' }, function (err, data) {
			assert.ifError(err);
			assert.equal(data.matchCount, 1);
			assert.equal(data.users[0].username, 'regular');
			done();
		});
	});

	it('should push unread notifications on reconnect', function (done) {
		var socketMeta = require('../src/socket.io/meta');
		socketMeta.reconnected({ uid: 1 }, {}, function (err) {
			assert.ifError(err);
			done();
		});
	});


	it('should error if the room is missing', function (done) {
		io.emit('meta.rooms.enter', null, function (err) {
			assert.equal(err.message, '[[error:invalid-data]]');
			done();
		});
	});

	it('should return if uid is 0', function (done) {
		var socketMeta = require('../src/socket.io/meta');
		socketMeta.rooms.enter({ uid: 0 }, null, function (err) {
			assert.ifError(err);
			done();
		});
	});

	it('should join a room', function (done) {
		io.emit('meta.rooms.enter', { enter: 'recent_topics' }, function (err) {
			assert.ifError(err);
			done();
		});
	});

	it('should leave current room', function (done) {
		io.emit('meta.rooms.leaveCurrent', {}, function (err) {
			assert.ifError(err);
			done();
		});
	});

	it('should get server time', function (done) {
		var socketMeta = require('../src/socket.io/meta');
		socketMeta.getServerTime({ uid: 1 }, null, function (err, time) {
			assert.ifError(err);
			assert(time);
			done();
		});
	});

	it('should error to get daily analytics with invalid data', function (done) {
		io.emit('admin.analytics.get', null, function (err) {
			assert.equal(err.message, '[[error:invalid-data]]');
			done();
		});
	});

	it('should get daily analytics', function (done) {
		io.emit('admin.analytics.get', { graph: 'traffic', units: 'days' }, function (err, data) {
			assert.ifError(err);
			assert(data);
			assert(data.summary);
			done();
		});
	});

	it('should get hourly analytics', function (done) {
		io.emit('admin.analytics.get', { graph: 'traffic', units: 'hours' }, function (err, data) {
			assert.ifError(err);
			assert(data);
			assert(data.summary);
			done();
		});
	});

	it('should allow a custom date range for traffic graph analytics', function (done) {
		io.emit('admin.analytics.get', { graph: 'traffic', units: 'days', amount: '7' }, function (err, data) {
			assert.ifError(err);
			assert(data);
			assert(data.pageviews);
			assert(data.uniqueVisitors);
			assert.strictEqual(7, data.pageviews.length);
			assert.strictEqual(7, data.uniqueVisitors.length);
			done();
		});
	});

	it('should return error', function (done) {
		socketAdmin.before({ uid: 10 }, 'someMethod', {}, function (err) {
			assert.equal(err.message, '[[error:no-privileges]]');
			done();
		});
	});

	it('should get room stats', function (done) {
		io.emit('meta.rooms.enter', { enter: 'topic_1' }, function (err) {
			assert.ifError(err);
			socketAdmin.rooms.getAll({ uid: 10 }, {}, function (err) {
				assert.ifError(err);
				setTimeout(function () {
					socketAdmin.rooms.getAll({ uid: 10 }, {}, function (err, data) {
						assert.ifError(err);
						assert(data.hasOwnProperty('onlineGuestCount'));
						assert(data.hasOwnProperty('onlineRegisteredCount'));
						assert(data.hasOwnProperty('socketCount'));
						assert(data.hasOwnProperty('topics'));
						assert(data.hasOwnProperty('users'));
						done();
					});
				}, 1000);
			});
		});
	});

	it('should get room stats', function (done) {
		io.emit('meta.rooms.enter', { enter: 'category_1' }, function (err) {
			assert.ifError(err);
			socketAdmin.rooms.getAll({ uid: 10 }, {}, function (err) {
				assert.ifError(err);
				setTimeout(function () {
					socketAdmin.rooms.getAll({ uid: 10 }, {}, function (err, data) {
						assert.ifError(err);
						assert.equal(data.users.category, 1);
						done();
					});
				}, 1000);
			});
		});
	});

	it('should get admin search dictionary', function (done) {
		socketAdmin.getSearchDict({ uid: adminUid }, {}, function (err, data) {
			assert.ifError(err);
			assert(Array.isArray(data));
			assert(data[0].namespace);
			assert(data[0].translations);
			assert(data[0].title);
			done();
		});
	});

	it('should fire event', function (done) {
		io.on('testEvent', function (data) {
			assert.equal(data.foo, 1);
			done();
		});
		socketAdmin.fireEvent({ uid: adminUid }, { name: 'testEvent', payload: { foo: 1 } }, function (err) {
			assert.ifError(err);
		});
	});

	it('should error with invalid data', function (done) {
		socketAdmin.themes.set({ uid: adminUid }, null, function (err) {
			assert.equal(err.message, '[[error:invalid-data]]');
			done();
		});
	});

	it('should set theme to bootswatch', function (done) {
		socketAdmin.themes.set({ uid: adminUid }, {
			type: 'bootswatch',
			src: '//maxcdn.bootstrapcdn.com/bootswatch/latest/darkly/bootstrap.min.css',
			id: 'darkly',
		}, function (err) {
			assert.ifError(err);
			meta.configs.getFields(['theme:src', 'bootswatchSkin'], function (err, fields) {
				assert.ifError(err);
				assert.equal(fields['theme:src'], '//maxcdn.bootstrapcdn.com/bootswatch/latest/darkly/bootstrap.min.css');
				assert.equal(fields.bootswatchSkin, 'darkly');
				done();
			});
		});
	});

	it('should set theme to local persona', function (done) {
		socketAdmin.themes.set({ uid: adminUid }, { type: 'local', id: 'nodebb-theme-persona' }, function (err) {
			assert.ifError(err);
			meta.configs.get('theme:id', function (err, id) {
				assert.ifError(err);
				assert.equal(id, 'nodebb-theme-persona');
				done();
			});
		});
	});

	it('should toggle plugin active', function (done) {
		socketAdmin.plugins.toggleActive({ uid: adminUid }, 'nodebb-plugin-location-to-map', function (err, data) {
			assert.ifError(err);
			assert.deepEqual(data, { id: 'nodebb-plugin-location-to-map', active: true });
			done();
		});
	});

	it('should toggle plugin install', function (done) {
		socketAdmin.plugins.toggleInstall({ uid: adminUid }, { id: 'nodebb-plugin-location-to-map', version: 'latest' }, function (err, data) {
			assert.ifError(err);
			assert.equal(data.name, 'nodebb-plugin-location-to-map');
			done();
		});
	});

	it('should get list of active plugins', function (done) {
		socketAdmin.plugins.getActive({ uid: adminUid }, {}, function (err, data) {
			assert.ifError(err);
			assert(Array.isArray(data));
			done();
		});
	});

	it('should order active plugins', function (done) {
		var data = [
			{ name: 'nodebb-theme-persona', order: 0 },
			{ name: 'nodebb-plugin-dbsearch', order: 1 },
			{ name: 'nodebb-plugin-soundpack-default', order: 2 },
			{ ignoreme: 'wrong data' },
		];
		socketAdmin.plugins.orderActivePlugins({ uid: adminUid }, data, function (err) {
			assert.ifError(err);
			db.sortedSetRank('plugins:active', 'nodebb-plugin-dbsearch', function (err, rank) {
				assert.ifError(err);
				assert.equal(rank, 1);
				done();
			});
		});
	});

	it('should upgrade plugin', function (done) {
		this.timeout(0);
		socketAdmin.plugins.upgrade({ uid: adminUid }, { id: 'nodebb-plugin-location-to-map', version: 'latest' }, function (err) {
			assert.ifError(err);
			done();
		});
	});

	it('should error with invalid data', function (done) {
		socketAdmin.widgets.set({ uid: adminUid }, null, function (err) {
			assert.equal(err.message, '[[error:invalid-data]]');
			done();
		});
	});

	it('should error with invalid data', function (done) {
		var data = [{ template: 'global', location: 'sidebar', widgets: [{ widget: 'html', data: { html: 'test', title: 'test', container: '' } }] }];
		socketAdmin.widgets.set({ uid: adminUid }, data, function (err) {
			assert.ifError(err);
			db.getObjectField('widgets:global', 'sidebar', function (err, widgetData) {
				assert.ifError(err);

				assert.equal(JSON.parse(widgetData)[0].data.html, 'test');
				done();
			});
		});
	});

	it('should clear sitemap cache', function (done) {
		socketAdmin.settings.clearSitemapCache({ uid: adminUid }, {}, function (err) {
			assert.ifError(err);
			done();
		});
	});

	it('should send test email', function (done) {
		socketAdmin.email.test({ uid: adminUid }, { template: 'digest.tpl' }, function (err) {
			assert.ifError(err);
			done();
		});
	});

	it('should get logs', function (done) {
		var fs = require('fs');
		var path = require('path');
		meta.logs.path = path.join(nconf.get('base_dir'), 'test/files', 'output.log');
		fs.appendFile(meta.logs.path, 'some logs', function (err) {
			assert.ifError(err);

			socketAdmin.logs.get({ uid: adminUid }, {}, function (err, data) {
				assert.ifError(err);
				assert(data);
				done();
			});
		});
	});

	it('should clear logs', function (done) {
		socketAdmin.logs.clear({ uid: adminUid }, {}, function (err) {
			assert.ifError(err);
			socketAdmin.logs.get({ uid: adminUid }, {}, function (err, data) {
				assert.ifError(err);
				assert.equal(data.length, 0);
				done();
			});
		});
	});

	it('should clear errors', function (done) {
		socketAdmin.errors.clear({ uid: adminUid }, {}, function (err) {
			assert.ifError(err);
			db.exists('error:404', function (err, exists) {
				assert.ifError(err);
				assert(!exists);
				done();
			});
		});
	});

	it('should delete all events', function (done) {
		socketAdmin.deleteAllEvents({ uid: adminUid }, {}, function (err) {
			assert.ifError(err);
			db.sortedSetCard('events:time', function (err, count) {
				assert.ifError(err);
				assert.equal(count, 0);
				done();
			});
		});
	});

	describe('logger', function () {
		var logger = require('../src/logger');
		var index = require('../src/socket.io');
		var fs = require('fs');
		var path = require('path');

		it('should enable logging', function (done) {
			meta.config.loggerStatus = 1;
			meta.config.loggerIOStatus = 1;
			var loggerPath = path.join(__dirname, '..', 'logs', 'logger.log');
			logger.monitorConfig({ io: index.server }, { key: 'loggerPath', value: loggerPath });
			setTimeout(function () {
				io.emit('meta.rooms.enter', { enter: 'recent_topics' }, function (err) {
					assert.ifError(err);
					fs.readFile(loggerPath, 'utf-8', function (err, content) {
						assert.ifError(err);
						assert(content);
						done();
					});
				});
			}, 500);
		});

		after(function (done) {
			meta.config.loggerStatus = 0;
			meta.config.loggerIOStatus = 0;
			done();
		});
	});
});

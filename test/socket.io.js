'use strict';

// see https://gist.github.com/jfromaniello/4087861#gistcomment-1447029

/* global process, require, before, after*/

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var assert = require('assert');
var async = require('async');
var nconf = require('nconf');
var request = require('request');
var cookies = request.jar();

var db = require('./mocks/databasemock');
var myXhr = require('./mocks/newXhr');
var user = require('../src/user');
var groups = require('../src/groups');
var categories = require('../src/categories');


describe('socket.io', function () {

	var io;
	var cid;
	var tid;
	var adminUid;
	var regularUid;

	before(function (done) {
		async.series([
			async.apply(user.create, { username: 'admin', password: 'adminpwd' }),
			async.apply(user.create, { username: 'regular', password: 'regularpwd', email: 'regular@test.com'}),
			async.apply(categories.create, {
				name: 'Test Category',
				description: 'Test category created by testing script'
			})
		], function (err, data) {
			if (err) {
				return done(err);
			}
			adminUid = data[0];
			regularUid = data[1];
			cid = data[2].cid;
			groups.resetCache();
			groups.join('administrators', data[0], done);
		});
	});


	it('should connect and auth properly', function (done) {
		request.get({
			url: nconf.get('url') + '/api/config',
			jar: cookies,
			json: true
		}, function (err, res, body) {
			assert.ifError(err);

			request.post(nconf.get('url') + '/login', {
				jar: cookies,
				form: {
					username: 'admin',
					password: 'adminpwd'
				},
				headers: {
					'x-csrf-token': body.csrf_token
				},
				json: true
			}, function (err, res, body) {
				assert.ifError(err);

				myXhr.callbacks.test2 = function () {
					this.setDisableHeaderCheck(true);
					var stdOpen = this.open;
					this.open = function () {
						stdOpen.apply(this, arguments);
						this.setRequestHeader('Cookie', res.headers['set-cookie'][0].split(';')[0]);
					};
				};

				io = require('socket.io-client')(nconf.get('url'), {forceNew: true});

				io.on('connect', function () {
					done();
				});

				io.on('error', function (err) {
					done(err);
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
		io.emit('topics.post', {title: 'test topic title', content: 'test topic main post content', uid: adminUid, cid: cid}, function (err, result) {
			assert.ifError(err);
			assert.equal(result.user.username, 'admin');
			assert.equal(result.category.cid, cid);
			assert.equal(result.mainPost.content, 'test topic main post content');
			tid = result.tid;
			done();
		});
	});

	it('should reply to topic', function (done) {
		io.emit('posts.reply', {tid: tid, uid: adminUid, content: 'test post content'}, function (err, result) {
			assert.ifError(err);
			assert.equal(result.uid, adminUid);
			assert.equal(result.user.username, 'admin');
			assert.equal(result.topic.tid, tid);
			done();
		});
	});

	it('should ban a user', function (done) {
		var socketUser = require('../src/socket.io/user');
		socketUser.banUsers({uid: adminUid}, {uids: [regularUid], reason: 'spammer'}, function (err) {
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
		socketUser.unbanUsers({uid: adminUid}, [regularUid], function (err) {
			assert.ifError(err);
			user.isBanned(regularUid, function (err, isBanned) {
				assert.ifError(err);
				assert(!isBanned);
				done();
			});
		});
	});

	it('should make user admin', function (done) {
		var socketAdmin = require('../src/socket.io/admin');
		socketAdmin.user.makeAdmins({uid: adminUid}, [regularUid], function (err) {
			assert.ifError(err);
			groups.isMember(regularUid, 'administrators', function (err, isMember) {
				assert.ifError(err);
				assert(isMember);
				done();
			});
		});
	});

	it('should make user non-admin', function (done) {
		var socketAdmin = require('../src/socket.io/admin');
		socketAdmin.user.removeAdmins({uid: adminUid}, [regularUid], function (err) {
			assert.ifError(err);
			groups.isMember(regularUid, 'administrators', function (err, isMember) {
				assert.ifError(err);
				assert(!isMember);
				done();
			});
		});
	});

	describe('create/delete', function () {
		var socketAdmin = require('../src/socket.io/admin');
		var uid;
		it('should create a user', function (done) {
			socketAdmin.user.createUser({uid: adminUid}, {username: 'foo1'}, function (err, _uid) {
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
			socketAdmin.user.deleteUsers({uid: adminUid}, [uid], function (err) {
				assert.ifError(err);
				groups.isMember(uid, 'registered-users', function (err, isMember) {
					assert.ifError(err);
					assert(!isMember);
					done();
				});
			});
		});

		it('should delete users and their content', function (done) {
			socketAdmin.user.deleteUsersAndContent({uid: adminUid}, [uid], function (err) {
				assert.ifError(err);
				done();
			});
		});
	});

	it('should error with invalid data', function (done) {
		var socketAdmin = require('../src/socket.io/admin');
		socketAdmin.user.createUser({uid: adminUid}, null, function (err) {
			assert.equal(err.message, '[[error:invalid-data]]');
			done();
		});
	});

	it('should reset lockouts', function (done) {
		var socketAdmin = require('../src/socket.io/admin');
		socketAdmin.user.resetLockouts({uid: adminUid}, [regularUid], function (err) {
			assert.ifError(err);
			done();
		});
	});

	it('should reset flags', function (done) {
		var socketAdmin = require('../src/socket.io/admin');
		socketAdmin.user.resetFlags({uid: adminUid}, [regularUid], function (err) {
			assert.ifError(err);
			done();
		});
	});

	it('should validate emails', function (done) {
		var socketAdmin = require('../src/socket.io/admin');
		socketAdmin.user.validateEmail({uid: adminUid}, [regularUid], function (err) {
			assert.ifError(err);
			user.getUserField(regularUid, 'email:confirmed', function (err, emailConfirmed) {
				assert.ifError(err);
				assert.equal(parseInt(emailConfirmed, 10), 1);
				done();
			});
		});
	});

	it('should search users', function (done) {
		var socketAdmin = require('../src/socket.io/admin');
		socketAdmin.user.search({uid: adminUid}, {query: 'reg', searchBy: 'username'}, function (err, data) {
			assert.ifError(err);
			assert.equal(data.matchCount, 1);
			assert.equal(data.users[0].username, 'regular');
			done();
		});
	});

	after(function (done) {
		db.emptydb(done);
	});

});


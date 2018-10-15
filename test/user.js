'use strict';

var assert = require('assert');
var async = require('async');
var path = require('path');
var nconf = require('nconf');
var request = require('request');

var db = require('./mocks/databasemock');
var User = require('../src/user');
var Topics = require('../src/topics');
var Categories = require('../src/categories');
var Password = require('../src/password');
var groups = require('../src/groups');
var helpers = require('./helpers');
var meta = require('../src/meta');
var plugins = require('../src/plugins');
var socketUser = require('../src/socket.io/user');

describe('User', function () {
	var userData;
	var testUid;
	var testCid;

	before(function (done) {
		Categories.create({
			name: 'Test Category',
			description: 'A test',
			order: 1,
		}, function (err, categoryObj) {
			if (err) {
				return done(err);
			}

			testCid = categoryObj.cid;
			done();
		});
	});

	beforeEach(function () {
		userData = {
			username: 'John Smith',
			fullname: 'John Smith McNamara',
			password: 'swordfish',
			email: 'john@example.com',
			callback: undefined,
		};
	});


	describe('.create(), when created', function () {
		it('should be created properly', function (done) {
			User.create({ username: userData.username, password: userData.password, email: userData.email }, function (error, userId) {
				assert.equal(error, null, 'was created with error');
				assert.ok(userId);

				testUid = userId;
				done();
			});
		});

		it('should have a valid email, if using an email', function (done) {
			User.create({ username: userData.username, password: userData.password, email: 'fakeMail' }, function (err) {
				assert(err);
				assert.equal(err.message, '[[error:invalid-email]]');
				done();
			});
		});

		it('should error with invalid password', function (done) {
			User.create({ username: 'test', password: '1' }, function (err) {
				assert.equal(err.message, '[[reset_password:password_too_short]]');
				done();
			});
		});

		it('should error with invalid password', function (done) {
			User.create({ username: 'test', password: {} }, function (err) {
				assert.equal(err.message, '[[error:invalid-password]]');
				done();
			});
		});

		it('should error with a too long password', function (done) {
			var toolong = '';
			for (var i = 0; i < 5000; i++) {
				toolong += 'a';
			}
			User.create({ username: 'test', password: toolong }, function (err) {
				assert.equal(err.message, '[[error:password-too-long]]');
				done();
			});
		});
	});

	describe('.uniqueUsername()', function () {
		it('should deal with collisions', function (done) {
			var users = [];
			for (var i = 0; i < 10; i += 1) {
				users.push({
					username: 'Jane Doe',
					email: 'jane.doe' + i + '@example.com',
				});
			}

			async.series([
				function (next) {
					async.eachSeries(users, function (user, next) {
						User.create(user, next);
					}, next);
				},
				function (next) {
					User.uniqueUsername({
						username: 'Jane Doe',
						userslug: 'jane-doe',
					}, function (err, username) {
						assert.ifError(err);

						assert.strictEqual(username, 'Jane Doe 9');
						next();
					});
				},
			], done);
		});
	});

	describe('.isModerator()', function () {
		it('should return false', function (done) {
			User.isModerator(testUid, testCid, function (err, isModerator) {
				assert.equal(err, null);
				assert.equal(isModerator, false);
				done();
			});
		});

		it('should return two false results', function (done) {
			User.isModerator([testUid, testUid], testCid, function (err, isModerator) {
				assert.equal(err, null);
				assert.equal(isModerator[0], false);
				assert.equal(isModerator[1], false);
				done();
			});
		});

		it('should return two false results', function (done) {
			User.isModerator(testUid, [testCid, testCid], function (err, isModerator) {
				assert.equal(err, null);
				assert.equal(isModerator[0], false);
				assert.equal(isModerator[1], false);
				done();
			});
		});
	});

	describe('.getModeratorUids()', function () {
		before(function (done) {
			groups.join('cid:1:privileges:moderate', 1, done);
		});

		it('should retrieve all users with moderator bit in category privilege', function (done) {
			User.getModeratorUids(function (err, uids) {
				assert.ifError(err);
				assert.strictEqual(1, uids.length);
				assert.strictEqual(1, parseInt(uids[0], 10));
				done();
			});
		});

		after(function (done) {
			groups.leave('cid:1:privileges:moderate', 1, done);
		});
	});

	describe('.getModeratorUids()', function () {
		before(function (done) {
			async.series([
				async.apply(groups.create, { name: 'testGroup' }),
				async.apply(groups.join, 'cid:1:privileges:groups:moderate', 'testGroup'),
				async.apply(groups.join, 'testGroup', 1),
			], done);
		});

		it('should retrieve all users with moderator bit in category privilege', function (done) {
			User.getModeratorUids(function (err, uids) {
				assert.ifError(err);
				assert.strictEqual(1, uids.length);
				assert.strictEqual(1, parseInt(uids[0], 10));
				done();
			});
		});

		after(function (done) {
			async.series([
				async.apply(groups.leave, 'cid:1:privileges:groups:moderate', 'testGroup'),
				async.apply(groups.destroy, 'testGroup'),
			], done);
		});
	});

	describe('.isReadyToPost()', function () {
		it('should error when a user makes two posts in quick succession', function (done) {
			meta.config = meta.config || {};
			meta.config.postDelay = '10';

			async.series([
				async.apply(Topics.post, {
					uid: testUid,
					title: 'Topic 1',
					content: 'lorem ipsum',
					cid: testCid,
				}),
				async.apply(Topics.post, {
					uid: testUid,
					title: 'Topic 2',
					content: 'lorem ipsum',
					cid: testCid,
				}),
			], function (err) {
				assert(err);
				done();
			});
		});

		it('should allow a post if the last post time is > 10 seconds', function (done) {
			User.setUserField(testUid, 'lastposttime', +new Date() - (11 * 1000), function () {
				Topics.post({
					uid: testUid,
					title: 'Topic 3',
					content: 'lorem ipsum',
					cid: testCid,
				}, function (err) {
					assert.ifError(err);
					done();
				});
			});
		});

		it('should error when a new user posts if the last post time is 10 < 30 seconds', function (done) {
			meta.config.newbiePostDelay = 30;
			meta.config.newbiePostDelayThreshold = 3;

			User.setUserField(testUid, 'lastposttime', +new Date() - (20 * 1000), function () {
				Topics.post({
					uid: testUid,
					title: 'Topic 4',
					content: 'lorem ipsum',
					cid: testCid,
				}, function (err) {
					assert(err);
					done();
				});
			});
		});

		it('should not error if a non-newbie user posts if the last post time is 10 < 30 seconds', function (done) {
			User.setUserFields(testUid, {
				lastposttime: +new Date() - (20 * 1000),
				reputation: 10,
			}, function () {
				Topics.post({
					uid: testUid,
					title: 'Topic 5',
					content: 'lorem ipsum',
					cid: testCid,
				}, function (err) {
					assert.ifError(err);
					done();
				});
			});
		});
	});

	describe('.search()', function () {
		var uid;
		it('should return an object containing an array of matching users', function (done) {
			User.search({ query: 'john' }, function (err, searchData) {
				assert.ifError(err);
				uid = searchData.users[0].uid;
				assert.equal(Array.isArray(searchData.users) && searchData.users.length > 0, true);
				assert.equal(searchData.users[0].username, 'John Smith');
				done();
			});
		});

		it('should search user', function (done) {
			socketUser.search({ uid: testUid }, { query: 'john' }, function (err, searchData) {
				assert.ifError(err);
				assert.equal(searchData.users[0].username, 'John Smith');
				done();
			});
		});

		it('should error for guest', function (done) {
			socketUser.search({ uid: 0 }, { query: 'john' }, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should error with invalid data', function (done) {
			socketUser.search({ uid: testUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should search users by ip', function (done) {
			User.create({ username: 'ipsearch' }, function (err, uid) {
				assert.ifError(err);
				db.sortedSetAdd('ip:1.1.1.1:uid', [1, 1], [testUid, uid], function (err) {
					assert.ifError(err);
					socketUser.search({ uid: testUid }, { query: '1.1.1.1', searchBy: 'ip' }, function (err, data) {
						assert.ifError(err);
						assert(Array.isArray(data.users));
						assert.equal(data.users.length, 2);
						done();
					});
				});
			});
		});

		it('should search users by ip', function (done) {
			socketUser.search({ uid: testUid }, { query: uid, searchBy: 'uid' }, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data.users));
				assert.equal(data.users[0].uid, uid);
				done();
			});
		});

		it('should return empty array if query is empty', function (done) {
			socketUser.search({ uid: testUid }, { query: '' }, function (err, data) {
				assert.ifError(err);
				assert.equal(data.users.length, 0);
				done();
			});
		});

		it('should filter users', function (done) {
			User.create({ username: 'ipsearch_filter' }, function (err, uid) {
				assert.ifError(err);
				User.setUserFields(uid, { banned: 1, flags: 10 }, function (err) {
					assert.ifError(err);
					socketUser.search({ uid: testUid }, {
						query: 'ipsearch',
						onlineOnly: true,
						bannedOnly: true,
						flaggedOnly: true,
					}, function (err, data) {
						assert.ifError(err);
						assert.equal(data.users[0].username, 'ipsearch_filter');
						done();
					});
				});
			});
		});

		it('should sort results by username', function (done) {
			async.waterfall([
				function (next) {
					User.create({ username: 'brian' }, next);
				},
				function (uid, next) {
					User.create({ username: 'baris' }, next);
				},
				function (uid, next) {
					User.create({ username: 'bzari' }, next);
				},
				function (uid, next) {
					User.search({
						uid: testUid,
						query: 'b',
						sortBy: 'username',
						paginate: false,
					}, next);
				},
			], function (err, data) {
				assert.ifError(err);
				assert.equal(data.users[0].username, 'baris');
				assert.equal(data.users[1].username, 'brian');
				assert.equal(data.users[2].username, 'bzari');
				done();
			});
		});
	});

	describe('.delete()', function () {
		var uid;
		before(function (done) {
			User.create({ username: 'usertodelete', password: '123456', email: 'delete@me.com' }, function (err, newUid) {
				assert.ifError(err);
				uid = newUid;
				done();
			});
		});

		it('should delete a user account', function (done) {
			User.delete(1, uid, function (err) {
				assert.ifError(err);
				User.existsBySlug('usertodelete', function (err, exists) {
					assert.ifError(err);
					assert.equal(exists, false);
					done();
				});
			});
		});
	});

	describe('passwordReset', function () {
		var uid;
		var code;
		before(function (done) {
			User.create({ username: 'resetuser', password: '123456', email: 'reset@me.com' }, function (err, newUid) {
				assert.ifError(err);
				uid = newUid;
				done();
			});
		});

		it('.generate() should generate a new reset code', function (done) {
			User.reset.generate(uid, function (err, _code) {
				assert.ifError(err);
				assert(_code);

				code = _code;
				done();
			});
		});

		it('.validate() should ensure that this new code is valid', function (done) {
			User.reset.validate(code, function (err, valid) {
				assert.ifError(err);
				assert.strictEqual(valid, true);
				done();
			});
		});

		it('.validate() should correctly identify an invalid code', function (done) {
			User.reset.validate(code + 'abcdef', function (err, valid) {
				assert.ifError(err);
				assert.strictEqual(valid, false);
				done();
			});
		});

		it('.send() should create a new reset code and reset password', function (done) {
			User.reset.send('reset@me.com', function (err) {
				if (err) {
					console.log(err);
				}
				done();
			});
		});

		it('.commit() should update the user\'s password and confirm their email', function (done) {
			User.reset.commit(code, 'newpassword', function (err) {
				assert.ifError(err);

				db.getObject('user:' + uid, function (err, userData) {
					assert.ifError(err);
					Password.compare('newpassword', userData.password, function (err, match) {
						assert.ifError(err);
						assert(match);
						assert.equal(parseInt(userData['email:confirmed'], 10), 1);
						done();
					});
				});
			});
		});

		it('.commit() should invalidate old codes', function (done) {
			var code1;
			var code2;
			var uid;
			async.waterfall([
				function (next) {
					User.create({ username: 'doublereseter', email: 'sorry@forgot.com', password: '123456' }, next);
				},
				function (_uid, next) {
					uid = _uid;
					User.reset.generate(uid, next);
				},
				function (code, next) {
					code1 = code;
					User.reset.generate(uid, next);
				},
				function (code, next) {
					code2 = code;
					User.reset.validate(code1, next);
				},
				function (isValid, next) {
					assert(isValid);
					User.reset.commit(code2, 'newPwd123', next);
				},
				function (next) {
					User.reset.validate(code1, next);
				},
				function (isValid, next) {
					assert(!isValid);
					next();
				},
			], done);
		});
	});

	describe('hash methods', function () {
		it('should return uid from email', function (done) {
			User.getUidByEmail('john@example.com', function (err, uid) {
				assert.ifError(err);
				assert.equal(parseInt(uid, 10), parseInt(testUid, 10));
				done();
			});
		});

		it('should return uid from username', function (done) {
			User.getUidByUsername('John Smith', function (err, uid) {
				assert.ifError(err);
				assert.equal(parseInt(uid, 10), parseInt(testUid, 10));
				done();
			});
		});

		it('should return uid from userslug', function (done) {
			User.getUidByUserslug('john-smith', function (err, uid) {
				assert.ifError(err);
				assert.equal(parseInt(uid, 10), parseInt(testUid, 10));
				done();
			});
		});

		it('should get user data even if one uid is NaN', function (done) {
			User.getUsersData([NaN, testUid], function (err, data) {
				assert.ifError(err);
				assert(data[0]);
				assert.equal(data[0].username, '[[global:guest]]');
				assert(data[1]);
				assert.equal(data[1].username, userData.username);
				done();
			});
		});

		it('should not return private user data', function (done) {
			User.setUserFields(testUid, {
				fb_token: '123123123',
				another_secret: 'abcde',
				postcount: '123',
			}, function (err) {
				assert.ifError(err);
				User.getUserData(testUid, function (err, userData) {
					assert.ifError(err);
					assert(!userData.hasOwnProperty('fb_token'));
					assert(!userData.hasOwnProperty('another_secret'));
					assert(!userData.hasOwnProperty('password'));
					assert(!userData.hasOwnProperty('rss_token'));
					assert.equal(userData.postcount, '123');
					done();
				});
			});
		});

		it('should return private data if field is whitelisted', function (done) {
			function filterMethod(data, callback) {
				data.whitelist.push('another_secret');
				callback(null, data);
			}

			plugins.registerHook('test-plugin', { hook: 'filter:user.whitelistFields', method: filterMethod });
			User.getUserData(testUid, function (err, userData) {
				assert.ifError(err);
				assert(!userData.hasOwnProperty('fb_token'));
				assert.equal(userData.another_secret, 'abcde');
				plugins.unregisterHook('test-plugin', 'filter:user.whitelistFields', filterMethod);
				done();
			});
		});

		it('should return 0 as uid if username is falsy', function (done) {
			User.getUidByUsername('', function (err, uid) {
				assert.ifError(err);
				assert.strictEqual(uid, 0);
				done();
			});
		});

		it('should get username by userslug', function (done) {
			User.getUsernameByUserslug('john-smith', function (err, username) {
				assert.ifError(err);
				assert.strictEqual('John Smith', username);
				done();
			});
		});

		it('should get uids by emails', function (done) {
			User.getUidsByEmails(['john@example.com'], function (err, uids) {
				assert.ifError(err);
				assert.equal(uids[0], testUid);
				done();
			});
		});
	});

	describe('not logged in', function () {
		it('should return error if not logged in', function (done) {
			socketUser.updateProfile({ uid: 0 }, {}, function (err) {
				assert.equal(err.message, '[[error:invalid-uid]]');
				done();
			});
		});
	});

	describe('profile methods', function () {
		var uid;
		var jar;

		before(function (done) {
			User.create({ username: 'updateprofile', email: 'update@me.com', password: '123456' }, function (err, newUid) {
				assert.ifError(err);
				uid = newUid;
				helpers.loginUser('updateprofile', '123456', function (err, _jar) {
					assert.ifError(err);
					jar = _jar;
					done();
				});
			});
		});

		it('should return error if data is invalid', function (done) {
			socketUser.updateProfile({ uid: uid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should return error if data is missing uid', function (done) {
			socketUser.updateProfile({ uid: uid }, { username: 'bip', email: 'bop' }, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should update a user\'s profile', function (done) {
			User.create({ username: 'justforupdate', email: 'just@for.updated', password: '123456' }, function (err, uid) {
				assert.ifError(err);
				var data = {
					uid: uid,
					username: 'updatedUserName',
					email: 'updatedEmail@me.com',
					fullname: 'updatedFullname',
					website: 'http://nodebb.org',
					location: 'izmir',
					groupTitle: 'testGroup',
					birthday: '01/01/1980',
					signature: 'nodebb is good',
				};
				socketUser.updateProfile({ uid: uid }, data, function (err, result) {
					assert.ifError(err);

					assert.equal(result.username, 'updatedUserName');
					assert.equal(result.userslug, 'updatedusername');
					assert.equal(result.email, 'updatedEmail@me.com');

					db.getObject('user:' + uid, function (err, userData) {
						assert.ifError(err);
						Object.keys(data).forEach(function (key) {
							assert.equal(data[key], userData[key]);
						});
						done();
					});
				});
			});
		});

		it('should change a user\'s password', function (done) {
			User.create({ username: 'changepassword', password: '123456' }, function (err, uid) {
				assert.ifError(err);
				socketUser.changePassword({ uid: uid }, { uid: uid, newPassword: '654321', currentPassword: '123456' }, function (err) {
					assert.ifError(err);
					User.isPasswordCorrect(uid, '654321', '127.0.0.1', function (err, correct) {
						assert.ifError(err);
						assert(correct);
						done();
					});
				});
			});
		});

		it('should change username', function (done) {
			socketUser.changeUsernameEmail({ uid: uid }, { uid: uid, username: 'updatedAgain', password: '123456' }, function (err) {
				assert.ifError(err);
				db.getObjectField('user:' + uid, 'username', function (err, username) {
					assert.ifError(err);
					assert.equal(username, 'updatedAgain');
					done();
				});
			});
		});

		it('should not update a user\'s username if it did not change', function (done) {
			socketUser.changeUsernameEmail({ uid: uid }, { uid: uid, username: 'updatedAgain', password: '123456' }, function (err) {
				assert.ifError(err);
				db.getSortedSetRevRange('user:' + uid + ':usernames', 0, -1, function (err, data) {
					assert.ifError(err);
					assert.equal(data.length, 2);
					assert(data[0].startsWith('updatedAgain'));
					done();
				});
			});
		});

		it('should change email', function (done) {
			User.create({ username: 'pooremailupdate', email: 'poor@update.me', password: '123456' }, function (err, uid) {
				assert.ifError(err);
				socketUser.changeUsernameEmail({ uid: uid }, { uid: uid, email: 'updatedAgain@me.com', password: '123456' }, function (err) {
					assert.ifError(err);
					db.getObjectField('user:' + uid, 'email', function (err, email) {
						assert.ifError(err);
						assert.equal(email, 'updatedAgain@me.com');
						done();
					});
				});
			});
		});

		it('should update cover image', function (done) {
			var imageData = 'data:image/png;base64,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';
			var position = '50.0301% 19.2464%';
			socketUser.updateCover({ uid: uid }, { uid: uid, imageData: imageData, position: position }, function (err, result) {
				assert.ifError(err);
				assert(result.url);
				db.getObjectFields('user:' + uid, ['cover:url', 'cover:position'], function (err, data) {
					assert.ifError(err);
					assert.equal(data['cover:url'], result.url);
					assert.equal(data['cover:position'], position);
					done();
				});
			});
		});

		it('should upload cropped profile picture', function (done) {
			var imageData = 'data:image/png;base64,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';
			socketUser.uploadCroppedPicture({ uid: uid }, { uid: uid, imageData: imageData }, function (err, result) {
				assert.ifError(err);
				assert(result.url);
				db.getObjectFields('user:' + uid, ['uploadedpicture', 'picture'], function (err, data) {
					assert.ifError(err);
					assert.equal(result.url, data.uploadedpicture);
					assert.equal(result.url, data.picture);
					done();
				});
			});
		});

		it('should remove cover image', function (done) {
			socketUser.removeCover({ uid: uid }, { uid: uid }, function (err) {
				assert.ifError(err);
				db.getObjectField('user:' + uid, 'cover:url', function (err, url) {
					assert.ifError(err);
					assert.equal(url, null);
					done();
				});
			});
		});

		it('should set user status', function (done) {
			socketUser.setStatus({ uid: uid }, 'away', function (err, data) {
				assert.ifError(err);
				assert.equal(data.uid, uid);
				assert.equal(data.status, 'away');
				done();
			});
		});

		it('should fail for invalid status', function (done) {
			socketUser.setStatus({ uid: uid }, '12345', function (err) {
				assert.equal(err.message, '[[error:invalid-user-status]]');
				done();
			});
		});

		it('should get user status', function (done) {
			socketUser.checkStatus({ uid: uid }, uid, function (err, status) {
				assert.ifError(err);
				assert.equal(status, 'away');
				done();
			});
		});

		it('should change user picture', function (done) {
			socketUser.changePicture({ uid: uid }, { type: 'default', uid: uid }, function (err) {
				assert.ifError(err);
				User.getUserField(uid, 'picture', function (err, picture) {
					assert.ifError(err);
					assert.equal(picture, '');
					done();
				});
			});
		});

		it('should fail to change user picture with invalid data', function (done) {
			socketUser.changePicture({ uid: uid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should fail to change user picture with invalid uid', function (done) {
			socketUser.changePicture({ uid: 0 }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-uid]]');
				done();
			});
		});

		it('should set user picture to uploaded', function (done) {
			User.setUserField(uid, 'uploadedpicture', '/test', function (err) {
				assert.ifError(err);
				socketUser.changePicture({ uid: uid }, { type: 'uploaded', uid: uid }, function (err) {
					assert.ifError(err);
					User.getUserField(uid, 'picture', function (err, picture) {
						assert.ifError(err);
						assert.equal(picture, nconf.get('relative_path') + '/test');
						done();
					});
				});
			});
		});

		it('should upload profile picture', function (done) {
			helpers.copyFile(
				path.join(nconf.get('base_dir'), 'test/files/test.png'),
				path.join(nconf.get('base_dir'), 'test/files/test_copy.png'),
				function (err) {
					assert.ifError(err);
					var picture = {
						path: path.join(nconf.get('base_dir'), 'test/files/test_copy.png'),
						size: 7189,
						name: 'test_copy.png',
						type: 'image/png',
					};
					User.uploadCroppedPicture({
						uid: uid,
						file: picture,
					}, function (err, uploadedPicture) {
						assert.ifError(err);
						assert.equal(uploadedPicture.url, '/assets/uploads/profile/' + uid + '-profileavatar.png');
						assert.equal(uploadedPicture.path, path.join(nconf.get('upload_path'), 'profile', uid + '-profileavatar.png'));
						done();
					});
				}
			);
		});

		it('should return error if profile image uploads disabled', function (done) {
			meta.config.allowProfileImageUploads = 0;
			var picture = {
				path: path.join(nconf.get('base_dir'), 'test/files/test.png'),
				size: 7189,
				name: 'test.png',
				type: 'image/png',
			};
			User.uploadCroppedPicture({
				uid: uid,
				file: picture,
			}, function (err) {
				assert.equal(err.message, '[[error:profile-image-uploads-disabled]]');
				done();
			});
		});

		it('should return error if profile image is too big', function (done) {
			meta.config.allowProfileImageUploads = 1;
			var picture = {
				path: path.join(nconf.get('base_dir'), 'test/files/test.png'),
				size: 265000,
				name: 'test.png',
				type: 'image/png',
			};

			User.uploadCroppedPicture({
				uid: uid,
				file: picture,
			}, function (err) {
				assert.equal(err.message, '[[error:file-too-big, 256]]');
				done();
			});
		});

		it('should return error if profile image has no mime type', function (done) {
			var picture = {
				path: path.join(nconf.get('base_dir'), 'test/files/test.png'),
				size: 7189,
				name: 'test',
			};
			User.uploadCroppedPicture({
				uid: uid,
				file: picture,
			}, function (err) {
				assert.equal(err.message, '[[error:invalid-image]]');
				done();
			});
		});

		describe('user.uploadCroppedPicture', function () {
			var goodImage = 'data:image/gif;base64,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';
			var badImage = 'data:audio/mp3;base64,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';
			it('should error if both file and imageData are missing', function (done) {
				User.uploadCroppedPicture({}, function (err) {
					assert.equal('[[error:invalid-data]]', err.message);
					done();
				});
			});

			it('should error if file size is too big', function (done) {
				var temp = meta.config.maximumProfileImageSize;
				meta.config.maximumProfileImageSize = 1;
				User.uploadCroppedPicture({
					uid: 1,
					imageData: goodImage,
				}, function (err) {
					assert.equal('[[error:file-too-big, 1]]', err.message);

					// Restore old value
					meta.config.maximumProfileImageSize = temp;
					done();
				});
			});

			it('should not allow image data with bad MIME type to be passed in', function (done) {
				User.uploadCroppedPicture({
					uid: 1,
					imageData: badImage,
				}, function (err) {
					assert.equal('[[error:invalid-image]]', err.message);
					done();
				});
			});
		});

		it('should get profile pictures', function (done) {
			socketUser.getProfilePictures({ uid: uid }, { uid: uid }, function (err, data) {
				assert.ifError(err);
				assert(data);
				assert(Array.isArray(data));
				assert.equal(data[0].type, 'uploaded');
				assert.equal(data[0].text, '[[user:uploaded_picture]]');
				done();
			});
		});

		it('should get default profile avatar', function (done) {
			assert.strictEqual(User.getDefaultAvatar(), '');
			meta.config.defaultAvatar = 'https://path/to/default/avatar';
			assert.strictEqual(User.getDefaultAvatar(), meta.config.defaultAvatar);
			meta.config.defaultAvatar = '/path/to/default/avatar';
			nconf.set('relative_path', '/community');
			assert.strictEqual(User.getDefaultAvatar(), '/community' + meta.config.defaultAvatar);
			meta.config.defaultAvatar = '';
			nconf.set('relative_path', '');
			done();
		});

		it('should fail to get profile pictures with invalid data', function (done) {
			socketUser.getProfilePictures({ uid: uid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketUser.getProfilePictures({ uid: uid }, { uid: null }, function (err) {
					assert.equal(err.message, '[[error:invalid-data]]');
					done();
				});
			});
		});

		it('should remove uploaded picture', function (done) {
			socketUser.removeUploadedPicture({ uid: uid }, { uid: uid }, function (err) {
				assert.ifError(err);
				User.getUserField(uid, 'uploadedpicture', function (err, uploadedpicture) {
					assert.ifError(err);
					assert.equal(uploadedpicture, '');
					done();
				});
			});
		});

		it('should fail to remove uploaded picture with invalid-data', function (done) {
			socketUser.removeUploadedPicture({ uid: uid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketUser.removeUploadedPicture({ uid: uid }, { }, function (err) {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketUser.removeUploadedPicture({ uid: null }, { }, function (err) {
						assert.equal(err.message, '[[error:invalid-data]]');
						done();
					});
				});
			});
		});

		it('should load profile page', function (done) {
			request(nconf.get('url') + '/api/user/updatedagain', { jar: jar, json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load settings page', function (done) {
			request(nconf.get('url') + '/api/user/updatedagain/settings', { jar: jar, json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body.settings);
				assert(body.languages);
				assert(body.homePageRoutes);
				done();
			});
		});

		it('should load edit page', function (done) {
			request(nconf.get('url') + '/api/user/updatedagain/edit', { jar: jar, json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load edit/email page', function (done) {
			request(nconf.get('url') + '/api/user/updatedagain/edit/email', { jar: jar, json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load user\'s groups page', function (done) {
			groups.create({
				name: 'Test',
				description: 'Foobar!',
			}, function (err) {
				assert.ifError(err);
				groups.join('Test', uid, function (err) {
					assert.ifError(err);
					request(nconf.get('url') + '/api/user/updatedagain/groups', { jar: jar, json: true }, function (err, res, body) {
						assert.ifError(err);
						assert.equal(res.statusCode, 200);
						assert(Array.isArray(body.groups));
						assert.equal(body.groups[0].name, 'Test');
						done();
					});
				});
			});
		});
	});

	describe('user info', function () {
		it('should return error if there is no ban reason', function (done) {
			User.getLatestBanInfo(123, function (err) {
				assert.equal(err.message, 'no-ban-info');
				done();
			});
		});


		it('should get history from set', function (done) {
			var now = Date.now();
			db.sortedSetAdd('user:' + testUid + ':usernames', now, 'derp:' + now, function (err) {
				assert.ifError(err);
				User.getHistory('user:' + testUid + ':usernames', function (err, data) {
					assert.ifError(err);
					assert.equal(data[0].value, 'derp');
					assert.equal(data[0].timestamp, now);
					done();
				});
			});
		});

		it('should return the correct ban reason', function (done) {
			async.series([
				function (next) {
					User.ban(testUid, 0, '', function (err) {
						assert.ifError(err);
						next(err);
					});
				},
				function (next) {
					User.getModerationHistory(testUid, function (err, data) {
						assert.ifError(err);
						assert.equal(data.bans.length, 1, 'one ban');
						assert.equal(data.bans[0].reason, '[[user:info.banned-no-reason]]', 'no ban reason');

						next(err);
					});
				},
			], function (err) {
				assert.ifError(err);
				User.unban(testUid, function (err) {
					assert.ifError(err);
					done();
				});
			});
		});

		it('should ban user permanently', function (done) {
			User.ban(testUid, function (err) {
				assert.ifError(err);
				User.isBanned(testUid, function (err, isBanned) {
					assert.ifError(err);
					assert.equal(isBanned, true);
					User.unban(testUid, done);
				});
			});
		});

		it('should ban user temporarily', function (done) {
			User.ban(testUid, Date.now() + 2000, function (err) {
				assert.ifError(err);

				User.isBanned(testUid, function (err, isBanned) {
					assert.ifError(err);
					assert.equal(isBanned, true);
					setTimeout(function () {
						User.isBanned(testUid, function (err, isBanned) {
							assert.ifError(err);
							assert.equal(isBanned, false);
							User.unban(testUid, done);
						});
					}, 3000);
				});
			});
		});

		it('should error if until is NaN', function (done) {
			User.ban(testUid, 'asd', function (err) {
				assert.equal(err.message, '[[error:ban-expiry-missing]]');
				done();
			});
		});
	});

	describe('Digest.getSubscribers', function (done) {
		var uidIndex = {};

		before(function (done) {
			var testUsers = ['daysub', 'offsub', 'nullsub', 'weeksub'];
			async.each(testUsers, function (username, next) {
				async.waterfall([
					async.apply(User.create, { username: username, email: username + '@example.com' }),
					function (uid, next) {
						if (username === 'nullsub') {
							return setImmediate(next);
						}

						uidIndex[username] = uid;

						var sub = username.slice(0, -3);
						async.parallel([
							async.apply(User.updateDigestSetting, uid, sub),
							async.apply(User.setSetting, uid, 'dailyDigestFreq', sub),
						], next);
					},
				], next);
			}, done);
		});

		it('should accurately build digest list given ACP default "null" (not set)', function (done) {
			User.digest.getSubscribers('day', function (err, subs) {
				assert.ifError(err);
				assert.strictEqual(subs.length, 1);

				done();
			});
		});

		it('should accurately build digest list given ACP default "day"', function (done) {
			async.series([
				async.apply(meta.configs.set, 'dailyDigestFreq', 'day'),
				function (next) {
					User.digest.getSubscribers('day', function (err, subs) {
						assert.ifError(err);
						assert.strictEqual(subs.includes(uidIndex.daysub.toString()), true);	// daysub does get emailed
						assert.strictEqual(subs.includes(uidIndex.weeksub.toString()), false);	// weeksub does not get emailed
						assert.strictEqual(subs.includes(uidIndex.offsub.toString()), false);	// offsub doesn't get emailed

						next();
					});
				},
			], done);
		});

		it('should accurately build digest list given ACP default "week"', function (done) {
			async.series([
				async.apply(meta.configs.set, 'dailyDigestFreq', 'week'),
				function (next) {
					User.digest.getSubscribers('week', function (err, subs) {
						assert.ifError(err);
						assert.strictEqual(subs.includes(uidIndex.weeksub.toString()), true);	// weeksub gets emailed
						assert.strictEqual(subs.includes(uidIndex.daysub.toString()), false);	// daysub gets emailed
						assert.strictEqual(subs.includes(uidIndex.offsub.toString()), false);	// offsub does not get emailed

						next();
					});
				},
			], done);
		});

		it('should accurately build digest list given ACP default "off"', function (done) {
			async.series([
				async.apply(meta.configs.set, 'dailyDigestFreq', 'off'),
				function (next) {
					User.digest.getSubscribers('day', function (err, subs) {
						assert.ifError(err);
						assert.strictEqual(subs.length, 1);

						next();
					});
				},
			], done);
		});
	});

	describe('digests', function () {
		var uid;
		before(function (done) {
			async.waterfall([
				function (next) {
					User.create({ username: 'digestuser', email: 'test@example.com' }, next);
				},
				function (_uid, next) {
					uid = _uid;
					User.updateDigestSetting(uid, 'day', next);
				},
				function (next) {
					User.setSetting(uid, 'dailyDigestFreq', 'day', next);
				},
			], done);
		});

		it('should send digests', function (done) {
			User.digest.execute({ interval: 'day' }, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should not send digests', function (done) {
			User.digest.execute({ interval: 'month' }, function (err) {
				assert.ifError(err);
				done();
			});
		});
	});

	describe('socket methods', function () {
		var socketUser = require('../src/socket.io/user');

		it('should fail with invalid data', function (done) {
			socketUser.exists({ uid: testUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should return true if user/group exists', function (done) {
			socketUser.exists({ uid: testUid }, { username: 'registered-users' }, function (err, exists) {
				assert.ifError(err);
				assert(exists);
				done();
			});
		});

		it('should return true if user/group exists', function (done) {
			socketUser.exists({ uid: testUid }, { username: 'John Smith' }, function (err, exists) {
				assert.ifError(err);
				assert(exists);
				done();
			});
		});

		it('should return false if user/group does not exists', function (done) {
			socketUser.exists({ uid: testUid }, { username: 'doesnot exist' }, function (err, exists) {
				assert.ifError(err);
				assert(!exists);
				done();
			});
		});

		it('should delete user', function (done) {
			User.create({ username: 'tobedeleted' }, function (err, _uid) {
				assert.ifError(err);
				socketUser.deleteAccount({ uid: _uid }, {}, function (err) {
					assert.ifError(err);
					socketUser.exists({ uid: testUid }, { username: 'doesnot exist' }, function (err, exists) {
						assert.ifError(err);
						assert(!exists);
						done();
					});
				});
			});
		});

		it('should fail if data is invalid', function (done) {
			socketUser.emailExists({ uid: testUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should return true if email exists', function (done) {
			socketUser.emailExists({ uid: testUid }, { email: 'john@example.com' }, function (err, exists) {
				assert.ifError(err);
				assert(exists);
				done();
			});
		});

		it('should return false if email does not exist', function (done) {
			socketUser.emailExists({ uid: testUid }, { email: 'does@not.exist' }, function (err, exists) {
				assert.ifError(err);
				assert(!exists);
				done();
			});
		});

		it('should error if requireEmailConfirmation is disabled', function (done) {
			socketUser.emailConfirm({ uid: testUid }, {}, function (err) {
				assert.equal(err.message, '[[error:email-confirmations-are-disabled]]');
				done();
			});
		});

		it('should send email confirm', function (done) {
			meta.config.requireEmailConfirmation = 1;
			socketUser.emailConfirm({ uid: testUid }, {}, function (err) {
				assert.ifError(err);
				meta.config.requireEmailConfirmation = 0;
				done();
			});
		});

		it('should send reset email', function (done) {
			socketUser.reset.send({ uid: 0 }, 'john@example.com', function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should return invalid-data error', function (done) {
			socketUser.reset.send({ uid: 0 }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should not error', function (done) {
			socketUser.reset.send({ uid: 0 }, 'doestnot@exist.com', function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should commit reset', function (done) {
			db.getObject('reset:uid', function (err, data) {
				assert.ifError(err);
				var code = Object.keys(data)[0];
				socketUser.reset.commit({ uid: 0 }, { code: code, password: 'swordfish' }, function (err) {
					assert.ifError(err);
					done();
				});
			});
		});

		it('should save user settings', function (done) {
			var data = {
				uid: 1,
				settings: {
					bootswatchSkin: 'default',
					homePageRoute: 'none',
					homePageCustom: '',
					openOutgoingLinksInNewTab: 0,
					scrollToMyPost: 1,
					delayImageLoading: 1,
					userLang: 'en-GB',
					usePagination: 1,
					topicsPerPage: '10',
					postsPerPage: '5',
					showemail: 1,
					showfullname: 1,
					restrictChat: 0,
					followTopicsOnCreate: 1,
					followTopicsOnReply: 1,
					notificationSound: '',
					incomingChatSound: '',
					outgoingChatSound: '',
				},
			};
			socketUser.saveSettings({ uid: testUid }, data, function (err) {
				assert.ifError(err);
				User.getSettings(testUid, function (err, data) {
					assert.ifError(err);
					assert.equal(data.usePagination, true);
					done();
				});
			});
		});

		it('should set moderation note', function (done) {
			var adminUid;
			async.waterfall([
				function (next) {
					User.create({ username: 'noteadmin' }, next);
				},
				function (_adminUid, next) {
					adminUid = _adminUid;
					groups.join('administrators', adminUid, next);
				},
				function (next) {
					socketUser.setModerationNote({ uid: adminUid }, { uid: testUid, note: 'this is a test user' }, next);
				},
				function (next) {
					setTimeout(next, 50);
				},
				function (next) {
					socketUser.setModerationNote({ uid: adminUid }, { uid: testUid, note: '<svg/onload=alert(document.location);//' }, next);
				},
				function (next) {
					User.getModerationNotes(testUid, 0, -1, next);
				},
			], function (err, notes) {
				assert.ifError(err);
				assert.equal(notes[0].note, '&lt;svg&#x2F;onload=alert(document.location);&#x2F;&#x2F;');
				assert.equal(notes[0].uid, adminUid);
				assert.equal(notes[1].note, 'this is a test user');
				assert(notes[0].timestamp);
				done();
			});
		});
	});

	describe('approval queue', function () {
		var socketAdmin = require('../src/socket.io/admin');

		var oldRegistrationType;
		var adminUid;
		before(function (done) {
			oldRegistrationType = meta.config.registrationType;
			meta.config.registrationType = 'admin-approval';
			User.create({ username: 'admin', password: '123456' }, function (err, uid) {
				assert.ifError(err);
				adminUid = uid;
				groups.join('administrators', uid, done);
			});
		});

		after(function (done) {
			meta.config.registrationType = oldRegistrationType;
			done();
		});

		it('should add user to approval queue', function (done) {
			helpers.registerUser({
				username: 'rejectme',
				password: '123456',
				'password-confirm': '123456',
				email: '<script>alert("ok")<script>reject@me.com',
				gdpr_consent: true,
			}, function (err) {
				assert.ifError(err);
				helpers.loginUser('admin', '123456', function (err, jar) {
					assert.ifError(err);
					request(nconf.get('url') + '/api/admin/manage/registration', { jar: jar, json: true }, function (err, res, body) {
						assert.ifError(err);
						assert.equal(body.users[0].username, 'rejectme');
						assert.equal(body.users[0].email, '&lt;script&gt;alert(&quot;ok&quot;)&lt;script&gt;reject@me.com');
						done();
					});
				});
			});
		});

		it('should reject user registration', function (done) {
			socketAdmin.user.rejectRegistration({ uid: adminUid }, { username: 'rejectme' }, function (err) {
				assert.ifError(err);
				User.getRegistrationQueue(0, -1, function (err, users) {
					assert.ifError(err);
					assert.equal(users.length, 0);
					done();
				});
			});
		});

		it('should accept user registration', function (done) {
			helpers.registerUser({
				username: 'acceptme',
				password: '123456',
				'password-confirm': '123456',
				email: 'accept@me.com',
				gdpr_consent: true,
			}, function (err) {
				assert.ifError(err);
				socketAdmin.user.acceptRegistration({ uid: adminUid }, { username: 'acceptme' }, function (err, uid) {
					assert.ifError(err);
					User.exists(uid, function (err, exists) {
						assert.ifError(err);
						assert(exists);
						User.getRegistrationQueue(0, -1, function (err, users) {
							assert.ifError(err);
							assert.equal(users.length, 0);
							done();
						});
					});
				});
			});
		});
	});

	describe('invites', function () {
		var socketUser = require('../src/socket.io/user');
		var inviterUid;

		before(function (done) {
			User.create({
				username: 'inviter',
				email: 'inviter@nodebb.org',
			}, function (err, uid) {
				assert.ifError(err);
				inviterUid = uid;
				done();
			});
		});

		it('should error with invalid data', function (done) {
			socketUser.invite({ uid: inviterUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should eror if forum is not invite only', function (done) {
			socketUser.invite({ uid: inviterUid }, 'invite1@test.com', function (err) {
				assert.equal(err.message, '[[error:forum-not-invite-only]]');
				done();
			});
		});

		it('should error if user is not admin and type is admin-invite-only', function (done) {
			meta.config.registrationType = 'admin-invite-only';
			socketUser.invite({ uid: inviterUid }, 'invite1@test.com', function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should send invitation email', function (done) {
			meta.config.registrationType = 'invite-only';
			socketUser.invite({ uid: inviterUid }, 'invite1@test.com', function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should error if ouf of invitations', function (done) {
			meta.config.maximumInvites = 1;
			socketUser.invite({ uid: inviterUid }, 'invite2@test.com', function (err) {
				assert.equal(err.message, '[[error:invite-maximum-met, ' + 1 + ', ' + 1 + ']]');
				meta.config.maximumInvites = 5;
				done();
			});
		});

		it('should error if email exists', function (done) {
			socketUser.invite({ uid: inviterUid }, 'inviter@nodebb.org', function (err) {
				assert.equal(err.message, '[[error:email-taken]]');
				done();
			});
		});

		it('should send invitation email', function (done) {
			socketUser.invite({ uid: inviterUid }, 'invite2@test.com', function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should get user\'s invites', function (done) {
			User.getInvites(inviterUid, function (err, data) {
				assert.ifError(err);
				assert.notEqual(data.indexOf('invite1@test.com'), -1);
				assert.notEqual(data.indexOf('invite2@test.com'), -1);
				done();
			});
		});

		it('should get all invites', function (done) {
			User.getAllInvites(function (err, data) {
				assert.ifError(err);
				assert.equal(data[0].uid, inviterUid);
				assert.notEqual(data[0].invitations.indexOf('invite1@test.com'), -1);
				assert.notEqual(data[0].invitations.indexOf('invite2@test.com'), -1);
				done();
			});
		});

		it('should fail to verify invitation with invalid data', function (done) {
			User.verifyInvitation({ token: '', email: '' }, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should fail to verify invitation with invalid email', function (done) {
			User.verifyInvitation({ token: 'test', email: 'doesnotexist@test.com' }, function (err) {
				assert.equal(err.message, '[[error:invalid-token]]');
				done();
			});
		});

		it('should verify installation with no errors', function (done) {
			var email = 'invite1@test.com';
			db.get('invitation:email:' + email, function (err, token) {
				assert.ifError(err);
				User.verifyInvitation({ token: token, email: 'invite1@test.com' }, function (err) {
					assert.ifError(err);
					done();
				});
			});
		});

		it('should error with invalid username', function (done) {
			User.deleteInvitation('doesnotexist', 'test@test.com', function (err) {
				assert.equal(err.message, '[[error:invalid-username]]');
				done();
			});
		});

		it('should delete invitation', function (done) {
			var socketAdmin = require('../src/socket.io/admin');
			socketAdmin.user.deleteInvitation({ uid: inviterUid }, { invitedBy: 'inviter', email: 'invite1@test.com' }, function (err) {
				assert.ifError(err);
				db.isSetMember('invitation:uid:' + inviterUid, 'invite1@test.com', function (err, isMember) {
					assert.ifError(err);
					assert.equal(isMember, false);
					done();
				});
			});
		});

		it('should delete invitation key', function (done) {
			User.deleteInvitationKey('invite2@test.com', function (err) {
				assert.ifError(err);
				db.isSetMember('invitation:uid:' + inviterUid, 'invite2@test.com', function (err, isMember) {
					assert.ifError(err);
					assert.equal(isMember, false);
					db.isSetMember('invitation:uids', inviterUid, function (err, isMember) {
						assert.ifError(err);
						assert.equal(isMember, false);
						done();
					});
				});
			});
		});

		it('should escape email', function (done) {
			socketUser.invite({ uid: inviterUid }, '<script>alert("ok");</script>', function (err) {
				assert.ifError(err);
				User.getInvites(inviterUid, function (err, data) {
					assert.ifError(err);
					assert.equal(data[0], '&lt;script&gt;alert(&quot;ok&quot;);&lt;&#x2F;script&gt;');
					done();
				});
			});
		});
	});

	describe('email confirm', function () {
		it('should error with invalid code', function (done) {
			User.email.confirm('asdasda', function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should confirm email of user', function (done) {
			var email = 'confirm@me.com';
			User.create({
				username: 'confirme',
				email: email,
			}, function (err, uid) {
				assert.ifError(err);
				User.email.sendValidationEmail(uid, email, function (err, code) {
					assert.ifError(err);
					User.email.confirm(code, function (err) {
						assert.ifError(err);

						async.parallel({
							confirmed: function (next) {
								db.getObjectField('user:' + uid, 'email:confirmed', next);
							},
							isMember: function (next) {
								db.isSortedSetMember('users:notvalidated', uid, next);
							},
						}, function (err, results) {
							assert.ifError(err);
							assert.equal(results.confirmed, 1);
							assert.equal(results.isMember, false);
							done();
						});
					});
				});
			});
		});
	});

	describe('user jobs', function () {
		it('should start user jobs', function (done) {
			User.startJobs(function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should stop user jobs', function (done) {
			User.stopJobs();
			done();
		});

		it('should send digest', function (done) {
			db.sortedSetAdd('digest:day:uids', [Date.now(), Date.now()], [1, 2], function (err) {
				assert.ifError(err);
				User.digest.execute({ interval: 'day' }, function (err) {
					assert.ifError(err);
					done();
				});
			});
		});
	});

	describe('hideEmail/hideFullname', function () {
		var uid;
		after(function (done) {
			meta.config.hideEmail = 0;
			meta.config.hideFullname = 0;
			done();
		});

		it('should hide email and fullname', function (done) {
			meta.config.hideEmail = 1;
			meta.config.hideFullname = 1;

			User.create({
				username: 'hiddenemail',
				email: 'should@be.hidden',
				fullname: 'baris soner usakli',
			}, function (err, _uid) {
				uid = _uid;
				assert.ifError(err);
				request(nconf.get('url') + '/api/user/hiddenemail', { json: true }, function (err, res, body) {
					assert.ifError(err);
					assert.equal(body.fullname, '');
					assert.equal(body.email, '');

					done();
				});
			});
		});

		it('should hide fullname in topic list and topic', function (done) {
			Topics.post({
				uid: uid,
				title: 'Topic hidden',
				content: 'lorem ipsum',
				cid: testCid,
			}, function (err) {
				assert.ifError(err);
				request(nconf.get('url') + '/api/recent', { json: true }, function (err, res, body) {
					assert.ifError(err);
					assert(!body.topics[0].user.hasOwnProperty('fullname'));
					request(nconf.get('url') + '/api/topic/' + body.topics[0].slug, { json: true }, function (err, res, body) {
						assert.ifError(err);
						assert(!body.posts[0].user.hasOwnProperty('fullname'));
						done();
					});
				});
			});
		});
	});

	describe('user blocking methods', function (done) {
		let blockeeUid;
		before(function (done) {
			User.create({
				username: 'blockee',
				email: 'blockee@example.org',
				fullname: 'Block me',
			}, function (err, uid) {
				blockeeUid = uid;
				done(err);
			});
		});

		describe('.toggle()', function () {
			it('should toggle block', function (done) {
				socketUser.toggleBlock({ uid: 1 }, { blockerUid: 1, blockeeUid: blockeeUid }, function (err) {
					assert.ifError(err);
					User.blocks.is(blockeeUid, 1, function (err, blocked) {
						assert.ifError(err);
						assert(blocked);
						done();
					});
				});
			});

			it('should toggle block', function (done) {
				socketUser.toggleBlock({ uid: 1 }, { blockerUid: 1, blockeeUid: blockeeUid }, function (err) {
					assert.ifError(err);
					User.blocks.is(blockeeUid, 1, function (err, blocked) {
						assert.ifError(err);
						assert(!blocked);
						done();
					});
				});
			});
		});

		describe('.add()', function () {
			it('should block a uid', function (done) {
				User.blocks.add(blockeeUid, 1, function (err) {
					assert.ifError(err);
					User.blocks.list(1, function (err, blocked_uids) {
						assert.ifError(err);
						assert.strictEqual(Array.isArray(blocked_uids), true);
						assert.strictEqual(blocked_uids.length, 1);
						assert.strictEqual(blocked_uids.includes(blockeeUid), true);
						done();
					});
				});
			});

			it('should automatically increment corresponding user field', function (done) {
				db.getObjectField('user:1', 'blocksCount', function (err, count) {
					assert.ifError(err);
					assert.strictEqual(parseInt(count, 10), 1);
					done();
				});
			});

			it('should error if you try to block the same uid again', function (done) {
				User.blocks.add(blockeeUid, 1, function (err) {
					assert.equal(err.message, '[[error:already-blocked]]');
					done();
				});
			});
		});

		describe('.remove()', function () {
			it('should unblock a uid', function (done) {
				User.blocks.remove(blockeeUid, 1, function (err) {
					assert.ifError(err);
					User.blocks.list(1, function (err, blocked_uids) {
						assert.ifError(err);
						assert.strictEqual(Array.isArray(blocked_uids), true);
						assert.strictEqual(blocked_uids.length, 0);
						done();
					});
				});
			});

			it('should automatically decrement corresponding user field', function (done) {
				db.getObjectField('user:1', 'blocksCount', function (err, count) {
					assert.ifError(err);
					assert.strictEqual(parseInt(count, 10), 0);
					done();
				});
			});

			it('should error if you try to unblock the same uid again', function (done) {
				User.blocks.remove(blockeeUid, 1, function (err) {
					assert.equal(err.message, '[[error:already-unblocked]]');
					done();
				});
			});
		});

		describe('.is()', function () {
			before(function (done) {
				User.blocks.add(blockeeUid, 1, done);
			});

			it('should return a Boolean with blocked status for the queried uid', function (done) {
				User.blocks.is(blockeeUid, 1, function (err, blocked) {
					assert.ifError(err);
					assert.strictEqual(blocked, true);
					done();
				});
			});
		});

		describe('.list()', function () {
			it('should return a list of blocked uids', function (done) {
				User.blocks.list(1, function (err, blocked_uids) {
					assert.ifError(err);
					assert.strictEqual(Array.isArray(blocked_uids), true);
					assert.strictEqual(blocked_uids.length, 1);
					assert.strictEqual(blocked_uids.includes(blockeeUid), true);
					done();
				});
			});
		});

		describe('.filter()', function () {
			it('should remove entries by blocked uids and return filtered set', function (done) {
				User.blocks.filter(1, [{
					foo: 'foo',
					uid: blockeeUid,
				}, {
					foo: 'bar',
					uid: 1,
				}, {
					foo: 'baz',
					uid: blockeeUid,
				}], function (err, filtered) {
					assert.ifError(err);
					assert.strictEqual(Array.isArray(filtered), true);
					assert.strictEqual(filtered.length, 1);
					assert.equal(filtered[0].uid, 1);
					done();
				});
			});

			it('should allow property argument to be passed in to customise checked property', function (done) {
				User.blocks.filter(1, 'fromuid', [{
					foo: 'foo',
					fromuid: blockeeUid,
				}, {
					foo: 'bar',
					fromuid: 1,
				}, {
					foo: 'baz',
					fromuid: blockeeUid,
				}], function (err, filtered) {
					assert.ifError(err);
					assert.strictEqual(Array.isArray(filtered), true);
					assert.strictEqual(filtered.length, 1);
					assert.equal(filtered[0].fromuid, 1);
					done();
				});
			});

			it('should not process invalid sets', function (done) {
				User.blocks.filter(1, [{ foo: 'foo' }, { foo: 'bar' }, { foo: 'baz' }], function (err, filtered) {
					assert.ifError(err);
					assert.strictEqual(Array.isArray(filtered), true);
					assert.strictEqual(filtered.length, 3);
					filtered.forEach(function (obj) {
						assert.strictEqual(obj.hasOwnProperty('foo'), true);
					});
					done();
				});
			});

			it('should process plain sets that just contain uids', function (done) {
				User.blocks.filter(1, [1, blockeeUid], function (err, filtered) {
					assert.ifError(err);
					assert.strictEqual(filtered.length, 1);
					assert.strictEqual(filtered[0], 1);
					done();
				});
			});

			it('should filter uids that are blocking targetUid', function (done) {
				User.blocks.filterUids(blockeeUid, [1, 2], function (err, filtered) {
					assert.ifError(err);
					assert.deepEqual(filtered, [2]);
					done();
				});
			});
		});
	});

	it('should return offline if user is guest', function (done) {
		var status = User.getStatus({ uid: 0 });
		assert.strictEqual(status, 'offline');
		done();
	});

	describe('isPrivilegedOrSelf', function () {
		it('should return not error if self', function (done) {
			User.isPrivilegedOrSelf(1, 1, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should not error if privileged', function (done) {
			User.create({ username: 'theadmin' }, function (err, uid) {
				assert.ifError(err);
				groups.join('administrators', uid, function (err) {
					assert.ifError(err);
					User.isPrivilegedOrSelf(uid, 2, function (err) {
						assert.ifError(err);
						done();
					});
				});
			});
		});

		it('should error if not privileged', function (done) {
			User.isPrivilegedOrSelf(0, 1, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});
	});

	it('should get admins and mods', function (done) {
		User.getAdminsandGlobalMods(function (err, data) {
			assert.ifError(err);
			assert(Array.isArray(data));
			done();
		});
	});
});

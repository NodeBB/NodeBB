'use strict';

var assert = require('assert');
var async = require('async');
var path = require('path');
var nconf = require('nconf');

var db = require('./mocks/databasemock');
var helpers = require('./helpers');
var Groups = require('../src/groups');
var User = require('../src/user');

describe('Groups', function () {
	var adminUid;
	var testUid;
	before(function (done) {
		async.series([
			function (next) {
				// Create a group to play around with
				Groups.create({
					name: 'Test',
					description: 'Foobar!',
				}, next);
			},
			function (next) {
				Groups.create({
					name: 'PrivateNoJoin',
					description: 'Private group',
					private: 1,
					disableJoinRequests: 1,
				}, next);
			},
			function (next) {
				Groups.create({
					name: 'PrivateCanJoin',
					description: 'Private group',
					private: 1,
					disableJoinRequests: 0,
				}, next);
			},
			function (next) {
				// Create a new user
				User.create({
					username: 'testuser',
					email: 'b@c.com',
				}, next);
			},
			function (next) {
				User.create({
					username: 'admin',
					email: 'admin@admin.com',
					password: '123456',
				}, next);
			},
			function (next) {
				// Also create a hidden group
				Groups.join('Hidden', 'Test', next);
			},
			function (next) {
				// create another group that starts with test for search/sort
				Groups.create({	name: 'Test2', description: 'Foobar!' }, next);
			},
		], function (err, results) {
			assert.ifError(err);
			testUid = results[3];
			adminUid = results[4];
			Groups.join('administrators', adminUid, done);
		});
	});

	describe('.list()', function () {
		it('should list the groups present', function (done) {
			Groups.getGroupsFromSet('groups:visible:createtime', 0, 0, -1, function (err, groups) {
				assert.ifError(err);
				assert.equal(groups.length, 4);
				done();
			});
		});
	});

	describe('.get()', function () {
		before(function (done) {
			Groups.join('Test', testUid, done);
		});

		it('with no options, should show group information', function (done) {
			Groups.get('Test', {}, function (err, groupObj) {
				assert.ifError(err);
				assert.equal(typeof groupObj, 'object');
				assert(Array.isArray(groupObj.members));
				assert.strictEqual(groupObj.name, 'Test');
				assert.strictEqual(groupObj.description, 'Foobar!');
				assert.strictEqual(groupObj.memberCount, 1);
				assert.equal(typeof groupObj.members[0], 'object');

				done();
			});
		});

		it('should return null if group does not exist', function (done) {
			Groups.get('doesnotexist', {}, function (err, groupObj) {
				assert.ifError(err);
				assert.strictEqual(groupObj, null);
				done();
			});
		});
	});

	describe('.search()', function () {
		var socketGroups = require('../src/socket.io/groups');

		it('should return empty array if query is falsy', function (done) {
			Groups.search(null, {}, function (err, groups) {
				assert.ifError(err);
				assert.equal(0, groups.length);
				done();
			});
		});

		it('should return the groups when search query is empty', function (done) {
			socketGroups.search({ uid: adminUid }, { query: '' }, function (err, groups) {
				assert.ifError(err);
				assert.equal(4, groups.length);
				done();
			});
		});

		it('should return the "Test" group when searched for', function (done) {
			socketGroups.search({ uid: adminUid }, { query: 'test' }, function (err, groups) {
				assert.ifError(err);
				assert.equal(2, groups.length);
				assert.strictEqual('Test', groups[0].name);
				done();
			});
		});

		it('should return the "Test" group when searched for and sort by member count', function (done) {
			Groups.search('test', { filterHidden: true, sort: 'count' }, function (err, groups) {
				assert.ifError(err);
				assert.equal(2, groups.length);
				assert.strictEqual('Test', groups[0].name);
				done();
			});
		});

		it('should return the "Test" group when searched for and sort by creation time', function (done) {
			Groups.search('test', { filterHidden: true, sort: 'date' }, function (err, groups) {
				assert.ifError(err);
				assert.equal(2, groups.length);
				assert.strictEqual('Test', groups[1].name);
				done();
			});
		});

		it('should return all users if no query', function (done) {
			function createAndJoinGroup(username, email, callback) {
				async.waterfall([
					function (next) {
						User.create({ username: username, email: email }, next);
					},
					function (uid, next) {
						Groups.join('Test', uid, next);
					},
				], callback);
			}
			async.series([
				function (next) {
					createAndJoinGroup('newuser', 'newuser@b.com', next);
				},
				function (next) {
					createAndJoinGroup('bob', 'bob@b.com', next);
				},
			], function (err) {
				assert.ifError(err);

				socketGroups.searchMembers({ uid: adminUid }, { groupName: 'Test', query: '' }, function (err, data) {
					assert.ifError(err);
					assert.equal(data.users.length, 3);
					done();
				});
			});
		});

		it('should search group members', function (done) {
			socketGroups.searchMembers({ uid: adminUid }, { groupName: 'Test', query: 'test' }, function (err, data) {
				assert.ifError(err);
				assert.strictEqual('testuser', data.users[0].username);
				done();
			});
		});
	});

	describe('.isMember()', function () {
		it('should return boolean true when a user is in a group', function (done) {
			Groups.isMember(1, 'Test', function (err, isMember) {
				assert.ifError(err);
				assert.strictEqual(isMember, true);
				done();
			});
		});

		it('should return boolean false when a user is not in a group', function (done) {
			Groups.isMember(2, 'Test', function (err, isMember) {
				assert.ifError(err);
				assert.strictEqual(isMember, false);
				done();
			});
		});
	});

	describe('.isMemberOfGroupList', function () {
		it('should report that a user is part of a groupList, if they are', function (done) {
			Groups.isMemberOfGroupList(1, 'Hidden', function (err, isMember) {
				assert.ifError(err);
				assert.strictEqual(isMember, true);
				done();
			});
		});

		it('should report that a user is not part of a groupList, if they are not', function (done) {
			Groups.isMemberOfGroupList(2, 'Hidden', function (err, isMember) {
				assert.ifError(err);
				assert.strictEqual(isMember, false);
				done();
			});
		});
	});

	describe('.exists()', function () {
		it('should verify that the test group exists', function (done) {
			Groups.exists('Test', function (err, exists) {
				assert.ifError(err);
				assert.strictEqual(exists, true);
				done();
			});
		});

		it('should verify that a fake group does not exist', function (done) {
			Groups.exists('Derp', function (err, exists) {
				assert.ifError(err);
				assert.strictEqual(exists, false);
				done();
			});
		});

		it('should check if group exists using an array', function (done) {
			Groups.exists(['Test', 'Derp'], function (err, groupsExists) {
				assert.ifError(err);
				assert.strictEqual(groupsExists[0], true);
				assert.strictEqual(groupsExists[1], false);
				done();
			});
		});
	});

	describe('.create()', function () {
		it('should create another group', function (done) {
			Groups.create({
				name: 'foo',
				description: 'bar',
			}, function (err) {
				assert.ifError(err);
				Groups.get('foo', {}, done);
			});
		});

		it('should create a hidden group if hidden is 1', function (done) {
			Groups.create({
				name: 'hidden group',
				hidden: '1',
			}, function (err) {
				assert.ifError(err);
				db.isSortedSetMember('groups:visible:memberCount', 'visible group', function (err, isMember) {
					assert.ifError(err);
					assert(!isMember);
					done();
				});
			});
		});

		it('should create a visible group if hidden is 0', function (done) {
			Groups.create({
				name: 'visible group',
				hidden: '0',
			}, function (err) {
				assert.ifError(err);
				db.isSortedSetMember('groups:visible:memberCount', 'visible group', function (err, isMember) {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			});
		});

		it('should create a visible group if hidden is not passed in', function (done) {
			Groups.create({
				name: 'visible group 2',
			}, function (err) {
				assert.ifError(err);
				db.isSortedSetMember('groups:visible:memberCount', 'visible group 2', function (err, isMember) {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			});
		});

		it('should fail to create group with duplicate group name', function (done) {
			Groups.create({ name: 'foo' }, function (err) {
				assert(err);
				assert.equal(err.message, '[[error:group-already-exists]]');
				done();
			});
		});

		it('should fail to create group if slug is empty', function (done) {
			Groups.create({ name: '>>>>' }, function (err) {
				assert.equal(err.message, '[[error:invalid-group-name]]');
				done();
			});
		});

		it('should fail if group name is invalid', function (done) {
			Groups.create({ name: 'not/valid' }, function (err) {
				assert.equal(err.message, '[[error:invalid-group-name]]');
				done();
			});
		});

		it('should fail if group name is invalid', function (done) {
			Groups.create({ name: 'not:valid' }, function (err) {
				assert.equal(err.message, '[[error:invalid-group-name]]');
				done();
			});
		});
	});

	describe('.hide()', function () {
		it('should mark the group as hidden', function (done) {
			Groups.hide('foo', function (err) {
				assert.ifError(err);

				Groups.get('foo', {}, function (err, groupObj) {
					assert.ifError(err);
					assert.strictEqual(true, groupObj.hidden);
					done();
				});
			});
		});
	});

	describe('.update()', function () {
		before(function (done) {
			Groups.create({
				name: 'updateTestGroup',
				description: 'bar',
				system: 0,
				hidden: 0,
			}, done);
		});

		it('should change an aspect of a group', function (done) {
			Groups.update('updateTestGroup', {
				description: 'baz',
			}, function (err) {
				assert.ifError(err);

				Groups.get('updateTestGroup', {}, function (err, groupObj) {
					assert.ifError(err);
					assert.strictEqual('baz', groupObj.description);
					done();
				});
			});
		});

		it('should rename a group if the name was updated', function (done) {
			Groups.update('updateTestGroup', {
				name: 'updateTestGroup?',
			}, function (err) {
				assert.ifError(err);

				Groups.get('updateTestGroup?', {}, function (err, groupObj) {
					assert.ifError(err);
					assert.strictEqual('updateTestGroup?', groupObj.name);
					assert.strictEqual('updatetestgroup', groupObj.slug);
					done();
				});
			});
		});

		it('should fail if system groups is being renamed', function (done) {
			Groups.update('administrators', {
				name: 'administrators_fail',
			}, function (err) {
				assert.equal(err.message, '[[error:not-allowed-to-rename-system-group]]');
				done();
			});
		});

		it('should fail to rename group to an existing group', function (done) {
			Groups.create({
				name: 'group2',
				system: 0,
				hidden: 0,
			}, function (err) {
				assert.ifError(err);
				Groups.update('group2', {
					name: 'updateTestGroup?',
				}, function (err) {
					assert.equal(err.message, '[[error:group-already-exists]]');
					done();
				});
			});
		});
	});

	describe('.destroy()', function () {
		before(function (done) {
			Groups.join('foobar?', 1, done);
		});

		it('should destroy a group', function (done) {
			Groups.destroy('foobar?', function (err) {
				assert.ifError(err);

				Groups.get('foobar?', {}, function (err, groupObj) {
					assert.ifError(err);
					assert.strictEqual(groupObj, null);

					done();
				});
			});
		});

		it('should also remove the members set', function (done) {
			db.exists('group:foo:members', function (err, exists) {
				assert.ifError(err);

				assert.strictEqual(false, exists);

				done();
			});
		});
	});

	describe('.join()', function () {
		before(function (done) {
			Groups.leave('Test', testUid, done);
		});

		it('should add a user to a group', function (done) {
			Groups.join('Test', testUid, function (err) {
				assert.ifError(err);

				Groups.isMember(testUid, 'Test', function (err, isMember) {
					assert.ifError(err);
					assert.strictEqual(true, isMember);

					done();
				});
			});
		});

		it('should fail to add user to group if group name is invalid', function (done) {
			Groups.join(0, 1, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				Groups.join(null, 1, function (err) {
					assert.equal(err.message, '[[error:invalid-data]]');
					Groups.join(undefined, 1, function (err) {
						assert.equal(err.message, '[[error:invalid-data]]');
						done();
					});
				});
			});
		});

		it('should fail to add user to group if uid is invalid', function (done) {
			Groups.join('Test', 0, function (err) {
				assert.equal(err.message, '[[error:invalid-uid]]');
				Groups.join('Test', null, function (err) {
					assert.equal(err.message, '[[error:invalid-uid]]');
					Groups.join('Test', undefined, function (err) {
						assert.equal(err.message, '[[error:invalid-uid]]');
						done();
					});
				});
			});
		});
	});

	describe('.leave()', function () {
		it('should remove a user from a group', function (done) {
			Groups.leave('Test', testUid, function (err) {
				assert.ifError(err);

				Groups.isMember(testUid, 'Test', function (err, isMember) {
					assert.ifError(err);
					assert.strictEqual(false, isMember);

					done();
				});
			});
		});
	});

	describe('.leaveAllGroups()', function () {
		it('should remove a user from all groups', function (done) {
			Groups.leaveAllGroups(testUid, function (err) {
				assert.ifError(err);

				var	groups = ['Test', 'Hidden'];
				async.every(groups, function (group, next) {
					Groups.isMember(testUid, group, function (err, isMember) {
						next(err, !isMember);
					});
				}, function (err, result) {
					assert.ifError(err);
					assert(result);

					done();
				});
			});
		});
	});

	describe('.show()', function () {
		it('should make a group visible', function (done) {
			Groups.show('Test', function (err) {
				assert.ifError(err);
				assert.equal(arguments.length, 1);
				db.isSortedSetMember('groups:visible:createtime', 'Test', function (err, isMember) {
					assert.ifError(err);
					assert.strictEqual(isMember, true);
					done();
				});
			});
		});
	});

	describe('.hide()', function () {
		it('should make a group hidden', function (done) {
			Groups.hide('Test', function (err) {
				assert.ifError(err);
				assert.equal(arguments.length, 1);
				db.isSortedSetMember('groups:visible:createtime', 'Test', function (err, isMember) {
					assert.ifError(err);
					assert.strictEqual(isMember, false);
					done();
				});
			});
		});
	});


	describe('socket methods', function () {
		var socketGroups = require('../src/socket.io/groups');
		var meta = require('../src/meta');

		it('should error if data is null', function (done) {
			socketGroups.before({ uid: 0 }, 'groups.join', null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should not error if data is valid', function (done) {
			socketGroups.before({ uid: 0 }, 'groups.join', {}, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should return error if not logged in', function (done) {
			socketGroups.join({ uid: 0 }, {}, function (err) {
				assert.equal(err.message, '[[error:invalid-uid]]');
				done();
			});
		});

		it('should return error if group name is special', function (done) {
			socketGroups.join({ uid: adminUid }, { groupName: 'administrators' }, function (err) {
				assert.equal(err.message, '[[error:not-allowed]]');
				done();
			});
		});

		it('should error if group does not exist', function (done) {
			socketGroups.join({ uid: adminUid }, { groupName: 'doesnotexist' }, function (err) {
				assert.equal(err.message, '[[error:no-group]]');
				done();
			});
		});

		it('should join test group', function (done) {
			meta.config.allowPrivateGroups = 0;
			socketGroups.join({ uid: adminUid }, { groupName: 'Test' }, function (err) {
				assert.ifError(err);
				Groups.isMember(adminUid, 'Test', function (err, isMember) {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			});
		});

		it('should error if not logged in', function (done) {
			socketGroups.leave({ uid: 0 }, {}, function (err) {
				assert.equal(err.message, '[[error:invalid-uid]]');
				done();
			});
		});

		it('should return error if group name is special', function (done) {
			socketGroups.leave({ uid: adminUid }, { groupName: 'administrators' }, function (err) {
				assert.equal(err.message, '[[error:cant-remove-self-as-admin]]');
				done();
			});
		});

		it('should leave test group', function (done) {
			socketGroups.leave({ uid: adminUid }, { groupName: 'Test' }, function (err) {
				assert.ifError(err);
				Groups.isMember('Test', adminUid, function (err, isMember) {
					assert.ifError(err);
					assert(!isMember);
					done();
				});
			});
		});

		it('should fail to join if group is private and join requests are disabled', function (done) {
			meta.config.allowPrivateGroups = 1;
			socketGroups.join({ uid: testUid }, { groupName: 'PrivateNoJoin' }, function (err) {
				assert.equal(err.message, '[[error:join-requests-disabled]]');
				done();
			});
		});

		it('should join if user is admin', function (done) {
			socketGroups.join({ uid: adminUid }, { groupName: 'PrivateCanJoin' }, function (err) {
				assert.ifError(err);
				Groups.isMember(adminUid, 'PrivateCanJoin', function (err, isMember) {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			});
		});

		it('should request membership for regular user', function (done) {
			socketGroups.join({ uid: testUid }, { groupName: 'PrivateCanJoin' }, function (err) {
				assert.ifError(err);
				Groups.isPending(testUid, 'PrivateCanJoin', function (err, isPending) {
					assert.ifError(err);
					assert(isPending);
					done();
				});
			});
		});

		it('should reject membership of user', function (done) {
			socketGroups.reject({ uid: adminUid }, { groupName: 'PrivateCanJoin', toUid: testUid }, function (err) {
				assert.ifError(err);
				Groups.isInvited(testUid, 'PrivateCanJoin', function (err, invited) {
					assert.ifError(err);
					assert.equal(invited, false);
					done();
				});
			});
		});

		it('should error if not owner or admin', function (done) {
			socketGroups.accept({ uid: 0 }, { groupName: 'PrivateCanJoin', toUid: testUid }, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should accept membership of user', function (done) {
			socketGroups.join({ uid: testUid }, { groupName: 'PrivateCanJoin' }, function (err) {
				assert.ifError(err);
				socketGroups.accept({ uid: adminUid }, { groupName: 'PrivateCanJoin', toUid: testUid }, function (err) {
					assert.ifError(err);
					Groups.isMember(testUid, 'PrivateCanJoin', function (err, isMember) {
						assert.ifError(err);
						assert(isMember);
						done();
					});
				});
			});
		});

		it('should reject/accept all memberships requests', function (done) {
			function requestMembership(uids, callback) {
				async.series([
					function (next) {
						socketGroups.join({ uid: uids.uid1 }, { groupName: 'PrivateCanJoin' }, next);
					},
					function (next) {
						socketGroups.join({ uid: uids.uid2 }, { groupName: 'PrivateCanJoin' }, next);
					},
				], function (err) {
					callback(err);
				});
			}
			var uids;
			async.waterfall([
				function (next) {
					async.parallel({
						uid1: function (next) {
							User.create({ username: 'groupuser1' }, next);
						},
						uid2: function (next) {
							User.create({ username: 'groupuser2' }, next);
						},
					}, next);
				},
				function (results, next) {
					uids = results;
					requestMembership(results, next);
				},
				function (next) {
					socketGroups.rejectAll({ uid: adminUid }, { groupName: 'PrivateCanJoin' }, next);
				},
				function (next) {
					Groups.getPending('PrivateCanJoin', next);
				},
				function (pending, next) {
					assert.equal(pending.length, 0);
					requestMembership(uids, next);
				},
				function (next) {
					socketGroups.acceptAll({ uid: adminUid }, { groupName: 'PrivateCanJoin' }, next);
				},
				function (next) {
					Groups.isMembers([uids.uid1, uids.uid2], 'PrivateCanJoin', next);
				},
				function (isMembers, next) {
					assert(isMembers[0]);
					assert(isMembers[1]);
					next();
				},
			], function (err) {
				done(err);
			});
		});

		it('should issue invite to user', function (done) {
			User.create({ username: 'invite1' }, function (err, uid) {
				assert.ifError(err);
				socketGroups.issueInvite({ uid: adminUid }, { groupName: 'PrivateCanJoin', toUid: uid }, function (err) {
					assert.ifError(err);
					Groups.isInvited(uid, 'PrivateCanJoin', function (err, isInvited) {
						assert.ifError(err);
						assert(isInvited);
						done();
					});
				});
			});
		});

		it('should fail with invalid data', function (done) {
			socketGroups.issueMassInvite({ uid: adminUid }, { groupName: 'PrivateCanJoin', usernames: null }, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should issue mass invite to users', function (done) {
			User.create({ username: 'invite2' }, function (err, uid) {
				assert.ifError(err);
				socketGroups.issueMassInvite({ uid: adminUid }, { groupName: 'PrivateCanJoin', usernames: 'invite1, invite2' }, function (err) {
					assert.ifError(err);
					Groups.isInvited(uid, 'PrivateCanJoin', function (err, isInvited) {
						assert.ifError(err);
						assert(isInvited);
						done();
					});
				});
			});
		});

		it('should rescind invite', function (done) {
			User.create({ username: 'invite3' }, function (err, uid) {
				assert.ifError(err);
				socketGroups.issueInvite({ uid: adminUid }, { groupName: 'PrivateCanJoin', toUid: uid }, function (err) {
					assert.ifError(err);
					socketGroups.rescindInvite({ uid: adminUid }, { groupName: 'PrivateCanJoin', toUid: uid }, function (err) {
						assert.ifError(err);
						Groups.isInvited(uid, 'PrivateCanJoin', function (err, isInvited) {
							assert.ifError(err);
							assert(!isInvited);
							done();
						});
					});
				});
			});
		});

		it('should error if user is not invited', function (done) {
			socketGroups.acceptInvite({ uid: adminUid }, { groupName: 'PrivateCanJoin' }, function (err) {
				assert.equal(err.message, '[[error:not-invited]]');
				done();
			});
		});

		it('should accept invite', function (done) {
			User.create({ username: 'invite4' }, function (err, uid) {
				assert.ifError(err);
				socketGroups.issueInvite({ uid: adminUid }, { groupName: 'PrivateCanJoin', toUid: uid }, function (err) {
					assert.ifError(err);
					socketGroups.acceptInvite({ uid: uid }, { groupName: 'PrivateCanJoin' }, function (err) {
						assert.ifError(err);
						Groups.isMember(uid, 'PrivateCanJoin', function (err, isMember) {
							assert.ifError(err);
							assert(isMember);
							done();
						});
					});
				});
			});
		});

		it('should reject invite', function (done) {
			User.create({ username: 'invite5' }, function (err, uid) {
				assert.ifError(err);
				socketGroups.issueInvite({ uid: adminUid }, { groupName: 'PrivateCanJoin', toUid: uid }, function (err) {
					assert.ifError(err);
					socketGroups.rejectInvite({ uid: uid }, { groupName: 'PrivateCanJoin' }, function (err) {
						assert.ifError(err);
						Groups.isInvited(uid, 'PrivateCanJoin', function (err, isInvited) {
							assert.ifError(err);
							assert(!isInvited);
							done();
						});
					});
				});
			});
		});

		it('should grant ownership to user', function (done) {
			socketGroups.grant({ uid: adminUid }, { groupName: 'PrivateCanJoin', toUid: testUid }, function (err) {
				assert.ifError(err);
				Groups.ownership.isOwner(testUid, 'PrivateCanJoin', function (err, isOwner) {
					assert.ifError(err);
					assert(isOwner);
					done();
				});
			});
		});

		it('should rescind ownership from user', function (done) {
			socketGroups.rescind({ uid: adminUid }, { groupName: 'PrivateCanJoin', toUid: testUid }, function (err) {
				assert.ifError(err);
				Groups.ownership.isOwner(testUid, 'PrivateCanJoin', function (err, isOwner) {
					assert.ifError(err);
					assert(!isOwner);
					done();
				});
			});
		});

		it('should fail to kick user with invalid data', function (done) {
			socketGroups.kick({ uid: adminUid }, { groupName: 'PrivateCanJoin', uid: adminUid }, function (err) {
				assert.equal(err.message, '[[error:cant-kick-self]]');
				done();
			});
		});

		it('should kick user from group', function (done) {
			socketGroups.kick({ uid: adminUid }, { groupName: 'PrivateCanJoin', uid: testUid }, function (err) {
				assert.ifError(err);
				Groups.isMember(testUid, 'PrivateCanJoin', function (err, isMember) {
					assert.ifError(err);
					assert(!isMember);
					done();
				});
			});
		});

		it('should fail to create group with invalid data', function (done) {
			socketGroups.create({ uid: 0 }, {}, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail to create group if group creation is disabled', function (done) {
			var oldValue = meta.config.allowGroupCreation;
			meta.config.allowGroupCreation = 0;
			socketGroups.create({ uid: 1 }, {}, function (err) {
				assert.equal(err.message, '[[error:group-creation-disabled]]');
				meta.config.allowGroupCreation = oldValue;
				done();
			});
		});

		it('should fail to create group if name is privilege group', function (done) {
			var oldValue = meta.config.allowGroupCreation;
			meta.config.allowGroupCreation = 1;
			socketGroups.create({ uid: 1 }, { name: 'cid:1:privileges:groups:find' }, function (err) {
				assert.equal(err.message, '[[error:invalid-group-name]]');
				meta.config.allowGroupCreation = oldValue;
				done();
			});
		});


		it('should create/update group', function (done) {
			var oldValue = meta.config.allowGroupCreation;
			meta.config.allowGroupCreation = 1;
			socketGroups.create({ uid: adminUid }, { name: 'createupdategroup' }, function (err, groupData) {
				meta.config.allowGroupCreation = oldValue;
				assert.ifError(err);
				assert(groupData);
				var data = {
					groupName: 'createupdategroup',
					values: {
						name: 'renamedupdategroup',
						description: 'cat group',
						userTitle: 'cats',
						userTitleEnabled: 1,
						disableJoinRequests: 1,
						hidden: 1,
						private: 0,
					},
				};
				socketGroups.update({ uid: adminUid }, data, function (err) {
					assert.ifError(err);
					Groups.get('renamedupdategroup', {}, function (err, groupData) {
						assert.ifError(err);
						assert.equal(groupData.name, 'renamedupdategroup');
						assert.equal(groupData.userTitle, 'cats');
						assert.equal(groupData.description, 'cat group');
						assert.equal(groupData.hidden, true);
						assert.equal(groupData.disableJoinRequests, true);
						assert.equal(groupData.private, false);
						done();
					});
				});
			});
		});

		it('should fail to create a group with name guests', function (done) {
			var oldValue = meta.config.allowGroupCreation;
			meta.config.allowGroupCreation = 1;
			socketGroups.create({ uid: adminUid }, { name: 'guests' }, function (err) {
				meta.config.allowGroupCreation = oldValue;
				assert.equal(err.message, '[[error:invalid-group-name]]');
				done();
			});
		});

		it('should fail to rename guests group', function (done) {
			var data = {
				groupName: 'guests',
				values: {
					name: 'guests2',
				},
			};
			socketGroups.update({ uid: adminUid }, data, function (err) {
				assert.equal(err.message, '[[error:no-group]]');
				done();
			});
		});

		it('should delete group', function (done) {
			socketGroups.delete({ uid: adminUid }, { groupName: 'renamedupdategroup' }, function (err) {
				assert.ifError(err);
				Groups.exists('renamedupdategroup', function (err, exists) {
					assert.ifError(err);
					assert(!exists);
					done();
				});
			});
		});

		it('should fail to delete group if name is special', function (done) {
			socketGroups.delete({ uid: adminUid }, { groupName: 'administrators' }, function (err) {
				assert.equal(err.message, '[[error:not-allowed]]');
				done();
			});
		});

		it('should fail to delete group if name is special', function (done) {
			socketGroups.delete({ uid: adminUid }, { groupName: 'registered-users' }, function (err) {
				assert.equal(err.message, '[[error:not-allowed]]');
				done();
			});
		});

		it('should fail to delete group if name is special', function (done) {
			socketGroups.delete({ uid: adminUid }, { groupName: 'Global Moderators' }, function (err) {
				assert.equal(err.message, '[[error:not-allowed]]');
				done();
			});
		});

		it('should fail to delete group if name is special', function (done) {
			socketGroups.delete({ uid: adminUid }, { groupName: 'guests' }, function (err) {
				assert.equal(err.message, '[[error:not-allowed]]');
				done();
			});
		});

		it('should fail to load more groups with invalid data', function (done) {
			socketGroups.loadMore({ uid: adminUid }, {}, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should load more groups', function (done) {
			socketGroups.loadMore({ uid: adminUid }, { after: 0, sort: 'count' }, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data.groups));
				done();
			});
		});

		it('should fail to load more members with invalid data', function (done) {
			socketGroups.loadMoreMembers({ uid: adminUid }, {}, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should load more members', function (done) {
			socketGroups.loadMoreMembers({ uid: adminUid }, { after: 0, groupName: 'PrivateCanJoin' }, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data.users));
				done();
			});
		});
	});

	describe('admin socket methods', function () {
		var socketGroups = require('../src/socket.io/admin/groups');

		it('should fail to create group with invalid data', function (done) {
			socketGroups.create({ uid: adminUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should fail to create group if group name is privilege group', function (done) {
			socketGroups.create({ uid: adminUid }, { name: 'cid:1:privileges:read' }, function (err) {
				assert.equal(err.message, '[[error:invalid-group-name]]');
				done();
			});
		});

		it('should create a group', function (done) {
			socketGroups.create({ uid: adminUid }, { name: 'newgroup', description: 'group created by admin' }, function (err, groupData) {
				assert.ifError(err);
				assert.equal(groupData.name, 'newgroup');
				assert.equal(groupData.description, 'group created by admin');
				assert.equal(groupData.ownerUid, adminUid);
				assert.equal(groupData.private, true);
				assert.equal(groupData.memberCount, 1);
				done();
			});
		});

		it('should fail to join with invalid data', function (done) {
			socketGroups.join({ uid: adminUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should add user to group', function (done) {
			socketGroups.join({ uid: adminUid }, { uid: testUid, groupName: 'newgroup' }, function (err) {
				assert.ifError(err);
				Groups.isMember(testUid, 'newgroup', function (err, isMember) {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			});
		});

		it('should fail to if user is already member', function (done) {
			socketGroups.join({ uid: adminUid }, { uid: testUid, groupName: 'newgroup' }, function (err) {
				assert.equal(err.message, '[[error:group-already-member]]');
				done();
			});
		});

		it('it should fail with invalid data', function (done) {
			socketGroups.leave({ uid: adminUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('it should fail if admin tries to remove self', function (done) {
			socketGroups.leave({ uid: adminUid }, { uid: adminUid, groupName: 'administrators' }, function (err) {
				assert.equal(err.message, '[[error:cant-remove-self-as-admin]]');
				done();
			});
		});

		it('should fail if user is not member', function (done) {
			socketGroups.leave({ uid: adminUid }, { uid: 3, groupName: 'newgroup' }, function (err) {
				assert.equal(err.message, '[[error:group-not-member]]');
				done();
			});
		});

		it('should remove user from group', function (done) {
			socketGroups.leave({ uid: adminUid }, { uid: testUid, groupName: 'newgroup' }, function (err) {
				assert.ifError(err);
				Groups.isMember(testUid, 'newgroup', function (err, isMember) {
					assert.ifError(err);
					assert(!isMember);
					done();
				});
			});
		});

		it('should fail with invalid data', function (done) {
			socketGroups.update({ uid: adminUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should update group', function (done) {
			var data = {
				groupName: 'newgroup',
				values: {
					name: 'renamedgroup',
					description: 'cat group',
					userTitle: 'cats',
					userTitleEnabled: 1,
					disableJoinRequests: 1,
					hidden: 1,
					private: 0,
				},
			};
			socketGroups.update({ uid: adminUid }, data, function (err) {
				assert.ifError(err);
				Groups.get('renamedgroup', {}, function (err, groupData) {
					assert.ifError(err);
					assert.equal(groupData.name, 'renamedgroup');
					assert.equal(groupData.userTitle, 'cats');
					assert.equal(groupData.description, 'cat group');
					assert.equal(groupData.hidden, true);
					assert.equal(groupData.disableJoinRequests, true);
					assert.equal(groupData.private, false);
					done();
				});
			});
		});
	});

	describe('groups cover', function () {
		var socketGroups = require('../src/socket.io/groups');
		var regularUid;
		var logoPath = path.join(__dirname, '../test/files/test.png');
		var imagePath = path.join(__dirname, '../test/files/groupcover.png');
		before(function (done) {
			User.create({ username: 'regularuser', password: '123456' }, function (err, uid) {
				assert.ifError(err);
				regularUid = uid;
				async.series([
					function (next) {
						Groups.join('Test', adminUid, next);
					},
					function (next) {
						Groups.join('Test', regularUid, next);
					},
					function (next) {
						helpers.copyFile(logoPath, imagePath, next);
					},
				], done);
			});
		});

		it('should fail if user is not logged in or not owner', function (done) {
			socketGroups.cover.update({ uid: 0 }, {}, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				socketGroups.cover.update({ uid: regularUid }, {}, function (err) {
					assert.equal(err.message, '[[error:no-privileges]]');
					done();
				});
			});
		});

		it('should upload group cover image from file', function (done) {
			var data = {
				groupName: 'Test',
				file: imagePath,
			};
			socketGroups.cover.update({ uid: adminUid }, data, function (err, data) {
				assert.ifError(err);
				Groups.getGroupFields('Test', ['cover:url'], function (err, groupData) {
					assert.ifError(err);
					assert.equal(data.url, groupData['cover:url']);
					done();
				});
			});
		});


		it('should upload group cover image from data', function (done) {
			var data = {
				groupName: 'Test',
				imageData: 'data:image/png;base64,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',
			};
			socketGroups.cover.update({ uid: adminUid }, data, function (err, data) {
				assert.ifError(err);
				Groups.getGroupFields('Test', ['cover:url'], function (err, groupData) {
					assert.ifError(err);
					assert.equal(data.url, groupData['cover:url']);
					done();
				});
			});
		});

		it('should update group cover position', function (done) {
			var data = {
				groupName: 'Test',
				position: '50% 50%',
			};
			socketGroups.cover.update({ uid: adminUid }, data, function (err) {
				assert.ifError(err);
				Groups.getGroupFields('Test', ['cover:position'], function (err, groupData) {
					assert.ifError(err);
					assert.equal('50% 50%', groupData['cover:position']);
					done();
				});
			});
		});

		it('should fail to update cover position if group name is missing', function (done) {
			Groups.updateCoverPosition('', '50% 50%', function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error if user is not owner of group', function (done) {
			helpers.loginUser('regularuser', '123456', function (err, jar, csrf_token) {
				assert.ifError(err);
				helpers.uploadFile(nconf.get('url') + '/api/groups/uploadpicture', logoPath, { params: JSON.stringify({ groupName: 'Test' }) }, jar, csrf_token, function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 500);
					assert.equal(body.error, '[[error:no-privileges]]');
					done();
				});
			});
		});

		it('should upload group cover with api route', function (done) {
			helpers.loginUser('admin', '123456', function (err, jar, csrf_token) {
				assert.ifError(err);
				helpers.uploadFile(nconf.get('url') + '/api/groups/uploadpicture', logoPath, { params: JSON.stringify({ groupName: 'Test' }) }, jar, csrf_token, function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					Groups.getGroupFields('Test', ['cover:url'], function (err, groupData) {
						assert.ifError(err);
						assert.equal(body[0].url, groupData['cover:url']);
						done();
					});
				});
			});
		});

		it('should fail to remove cover if not logged in', function (done) {
			socketGroups.cover.remove({ uid: 0 }, { groupName: 'Test' }, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail to remove cover if not owner', function (done) {
			socketGroups.cover.remove({ uid: regularUid }, { groupName: 'Test' }, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should remove cover', function (done) {
			socketGroups.cover.remove({ uid: adminUid }, { groupName: 'Test' }, function (err) {
				assert.ifError(err);
				Groups.getGroupFields('Test', ['cover:url'], function (err, groupData) {
					assert.ifError(err);
					assert(!groupData['cover:url']);
					done();
				});
			});
		});
	});
});

'use strict';
/*global require, before, after*/

var assert = require('assert');
var async = require('async');

var db = require('./mocks/databasemock');
var Groups = require('../src/groups');
var User = require('../src/user');

describe('Groups', function () {
	var adminUid;
	var testUid;
	before(function (done) {
		Groups.resetCache();
		async.series([
			function (next) {
				// Create a group to play around with
				Groups.create({
					name: 'Test',
					description: 'Foobar!'
				}, next);
			},
			function (next) {
				Groups.create({
					name: 'PrivateNoJoin',
					description: 'Private group',
					private: 1,
					disableJoinRequests: 1
				}, next);
			},
			function (next) {
				Groups.create({
					name: 'PrivateCanJoin',
					description: 'Private group',
					private: 1,
					disableJoinRequests: 0
				}, next);
			},
			function (next) {
				// Create a new user
				User.create({
					username: 'testuser',
					email: 'b@c.com'
				}, next);
			},
			function (next) {
				User.create({
					username: 'admin',
					email: 'admin@admin.com'
				}, next);
			},
			function (next) {
				// Also create a hidden group
				Groups.join('Hidden', 'Test', next);
			}
		], function (err, results) {
			assert.ifError(err);
			testUid = results[3];
			adminUid = results[4];
			Groups.join('administrators', adminUid, done);
		});
	});

	describe('.list()', function () {
		it('should list the groups present', function (done) {
			Groups.getGroupsFromSet('groups:createtime', 0, 0, -1, function (err, groups) {
				assert.ifError(err);
				assert.equal(groups.length, 6);
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
	});

	describe('.search()', function () {
		var socketGroups = require('../src/socket.io/groups');

		it('should return the groups when search query is empty', function (done) {
			socketGroups.search({uid: adminUid}, {query: ''}, function (err, groups) {
				assert.ifError(err);
				assert.equal(3, groups.length);
				done();
			});
		});

		it('should return the "Test" group when searched for', function (done) {
			socketGroups.search({uid: adminUid}, {query: 'test'}, function (err, groups) {
				assert.ifError(err);
				assert.equal(1, groups.length);
				assert.strictEqual('Test', groups[0].name);
				done();
			});
		});

		it('should return the "Test" group when searched for and sort by member count', function (done) {
			Groups.search('test', {filterHidden: true, sort: 'count'}, function (err, groups) {
				assert.ifError(err);
				assert.equal(1, groups.length);
				assert.strictEqual('Test', groups[0].name);
				done();
			});
		});

		it('should return the "Test" group when searched for and sort by creation time', function (done) {
			Groups.search('test', {filterHidden: true, sort: 'date'}, function (err, groups) {
				assert.ifError(err);
				assert.equal(1, groups.length);
				assert.strictEqual('Test', groups[0].name);
				done();
			});
		});

		it('should return all users if no query', function (done) {
			User.create({
				username: 'newuser',
				email: 'newuser@b.com'
			}, function (err, uid) {
				assert.ifError(err);
				Groups.join('Test', uid, function (err) {
					assert.ifError(err);
					socketGroups.searchMembers({uid: adminUid}, {groupName: 'Test', query: ''}, function (err, data) {
						assert.ifError(err);
						assert.equal(data.users.length, 2);
						done();
					});
				});
			});
		});

		it('should search group members', function (done) {
			socketGroups.searchMembers({uid: adminUid}, {groupName: 'Test', query: 'test'}, function (err, data) {
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
				description: 'bar'
			}, function (err) {
				assert.ifError(err);
				Groups.get('foo', {}, done);
			});
		});

		it('should fail to create group with duplicate group name', function (done) {
			Groups.create({name: 'foo'}, function (err) {
				assert(err);
				assert.equal(err.message, '[[error:group-already-exists]]');
				done();
			});
		});

		it('should fail to create group if slug is empty', function (done) {
			Groups.create({name: '>>>>'}, function (err) {
				assert.equal(err.message, '[[error:invalid-group-name]]');
				done();
			});
		});

		it('should fail if group name is invalid', function (done) {
			Groups.create({name: 'not/valid'}, function (err) {
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
				hidden: 0
			}, done);
		});

		it('should change an aspect of a group', function (done) {
			Groups.update('updateTestGroup', {
				description: 'baz'
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
				name: 'updateTestGroup?'
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
	});

	describe('.destroy()', function () {
		before(function (done) {
			Groups.join('foobar?', 1, done);
		});

		it('should destroy a group', function (done) {
			Groups.destroy('foobar?', function (err) {
				assert.ifError(err);

				Groups.get('foobar?', {}, function (err) {
					assert(err, 'Group still exists!');

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
						assert.ifError(err);
						next(!isMember);
					});
				}, function (result) {
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
			socketGroups.before({uid: 0}, 'groups.join', null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should not error if data is valid', function (done) {
			socketGroups.before({uid: 0}, 'groups.join', {}, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should return error if not logged in', function (done) {
			socketGroups.join({uid: 0}, {}, function (err) {
				assert.equal(err.message, '[[error:invalid-uid]]');
				done();
			});
		});

		it('should return error if group name is special', function (done) {
			socketGroups.join({uid: adminUid}, {groupName: 'administrators'}, function (err) {
				assert.equal(err.message, '[[error:not-allowed]]');
				done();
			});
		});

		it('should error if group does not exist', function (done) {
			socketGroups.join({uid: adminUid}, {groupName: 'doesnotexist'}, function (err) {
				assert.equal(err.message, '[[error:no-group]]');
				done();
			});
		});

		it('should join test group', function (done) {
			meta.config.allowPrivateGroups = 0;
			socketGroups.join({uid: adminUid}, {groupName: 'Test'}, function (err) {
				assert.ifError(err);
				Groups.isMember(adminUid, 'Test', function (err, isMember) {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			});
		});

		it('should error if not logged in', function (done) {
			socketGroups.leave({uid: 0}, {}, function (err) {
				assert.equal(err.message, '[[error:invalid-uid]]');
				done();
			});
		});

		it('should return error if group name is special', function (done) {
			socketGroups.leave({uid: adminUid}, {groupName: 'administrators'}, function (err) {
				assert.equal(err.message, '[[error:cant-remove-self-as-admin]]');
				done();
			});
		});

		it('should leave test group', function (done) {
			socketGroups.leave({uid: adminUid}, {groupName: 'Test'}, function (err) {
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
			socketGroups.join({uid: testUid}, {groupName: 'PrivateNoJoin'}, function (err) {
				assert.equal(err.message, '[[error:join-requests-disabled]]');
				done();
			});
		});

		it('should join if user is admin', function (done) {
			socketGroups.join({uid: adminUid}, {groupName: 'PrivateCanJoin'}, function (err) {
				assert.ifError(err);
				Groups.isMember(adminUid, 'PrivateCanJoin', function (err, isMember) {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			});
		});

		it('should request membership for regular user', function (done) {
			socketGroups.join({uid: testUid}, {groupName: 'PrivateCanJoin'}, function (err) {
				assert.ifError(err);
				Groups.isPending(testUid, 'PrivateCanJoin', function (err, isPending) {
					assert.ifError(err);
					assert(isPending);
					done();
				});
			});
		});

		it('should accept membership of user', function (done) {
			socketGroups.accept({uid: adminUid}, {groupName: 'PrivateCanJoin', toUid: testUid}, function (err) {
				assert.ifError(err);
				Groups.isMember(testUid, 'PrivateCanJoin', function (err, isMember) {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			});
		});

		it('should grant ownership to user', function (done) {
			socketGroups.grant({uid: adminUid}, {groupName: 'PrivateCanJoin', toUid: testUid}, function (err) {
				assert.ifError(err);
				Groups.ownership.isOwner(testUid, 'PrivateCanJoin', function (err, isOwner) {
					assert.ifError(err);
					assert(isOwner);
					done();
				});
			});
		});

		it('should rescind ownership from user', function (done) {
			socketGroups.rescind({uid: adminUid}, {groupName: 'PrivateCanJoin', toUid: testUid}, function (err) {
				assert.ifError(err);
				Groups.ownership.isOwner(testUid, 'PrivateCanJoin', function (err, isOwner) {
					assert.ifError(err);
					assert(!isOwner);
					done();
				});
			});
		});

		it('should kick user from group', function (done) {
			socketGroups.kick({uid: adminUid}, {groupName: 'PrivateCanJoin', uid: testUid}, function (err) {
				assert.ifError(err);
				Groups.isMember(testUid, 'PrivateCanJoin', function (err, isMember) {
					assert.ifError(err);
					assert(!isMember);
					done();
				});
			});
		});

	});

	describe('admin socket methods', function () {
		var socketGroups = require('../src/socket.io/admin/groups');

		it('should fail to create group with invalid data', function (done) {
			socketGroups.create({uid: adminUid}, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should fail to create group if group name is privilege group', function (done) {
			socketGroups.create({uid: adminUid}, {name: 'cid:1:privileges:read'}, function (err) {
				assert.equal(err.message, '[[error:invalid-group-name]]');
				done();
			});
		});

		it('should create a group', function (done) {
			socketGroups.create({uid: adminUid}, {name: 'newgroup', description: 'group created by admin'}, function (err, groupData) {
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
			socketGroups.join({uid: adminUid}, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should add user to group', function (done) {
			socketGroups.join({uid: adminUid}, {uid: testUid, groupName: 'newgroup'}, function (err) {
				assert.ifError(err);
				Groups.isMember(testUid, 'newgroup', function (err, isMember) {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			});
		});

		it('should fail to if user is already member', function (done) {
			socketGroups.join({uid: adminUid}, {uid: testUid, groupName: 'newgroup'}, function (err) {
				assert.equal(err.message, '[[error:group-already-member]]');
				done();
			});
		});

		it('it should fail with invalid data', function (done) {
			socketGroups.leave({uid: adminUid}, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('it should fail if admin tries to remove self', function (done) {
			socketGroups.leave({uid: adminUid}, {uid: adminUid, groupName: 'administrators'}, function (err) {
				assert.equal(err.message, '[[error:cant-remove-self-as-admin]]');
				done();
			});
		});

		it('should fail if user is not member', function (done) {
			socketGroups.leave({uid: adminUid}, {uid: 3, groupName: 'newgroup'}, function (err) {
				assert.equal(err.message, '[[error:group-not-member]]');
				done();
			});
		});

		it('should remove user from group', function (done) {
			socketGroups.leave({uid: adminUid}, {uid: testUid, groupName: 'newgroup'}, function (err) {
				assert.ifError(err);
				Groups.isMember(testUid, 'newgroup', function (err, isMember) {
					assert.ifError(err);
					assert(!isMember);
					done();
				});
			});
		});

		it('should fail with invalid data', function (done) {
			socketGroups.update({uid: adminUid}, null, function (err) {
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
					private: 0
				}
			};
			socketGroups.update({uid: adminUid}, data, function (err) {
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

	after(function (done) {
		db.emptydb(done);
	});
});

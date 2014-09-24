var	assert = require('assert'),
	async = require('async'),

	db = require('./mocks/databasemock'),
	Groups = require('../src/groups'),
	User = require('../src/user');

describe('Groups', function() {
	before(function(done) {
		async.parallel([
			function(next) {
				// Create a group to play around with
				Groups.create('Test', 'Foobar!', next);
			},
			function(next) {
				// Create a new user
					User.create({
					username: 'testuser',
					email: 'b@c.com'
				}, done);
			},
			function(next) {
				// Also create a hidden group
				Groups.join('Hidden', 'Test', next);
			}
		], done);
	});

	describe('.list()', function() {
		it('should list the groups present', function(done) {
			Groups.list({}, function(err, groups) {
				if (err) return done(err);

				assert.equal(groups.length, 1);
				done();
			});
		});
	});

	describe('.get()', function() {
		before(function(done) {
			Groups.join('Test', 1, done);
		});

		it('with no options, should show group information', function(done) {
			Groups.get('Test', {}, function(err, groupObj) {
				if (err) return done(err);

				assert.equal(typeof groupObj, 'object');
				assert(Array.isArray(groupObj.members));
				assert.strictEqual(groupObj.name, 'Test');
				assert.strictEqual(groupObj.description, 'Foobar!');
				assert.strictEqual(groupObj.memberCount, 1);
				assert.notEqual(typeof groupObj.members[0], 'object');

				done();
			});
		});

		it('with the "expand" option, should show both group information and user information', function(done) {
			Groups.get('Test', { expand: true }, function(err, groupObj) {
				if (err) return done(err);

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

	describe('.search()', function() {
		it('should return the "Test" group when searched for', function(done) {
			Groups.search('test', {}, function(err, groups) {
				assert.equal(1, groups.length);
				assert.strictEqual('Test', groups[0].name);
				done();
			});
		});

		it('should return the "Hidden" group when "showAllGroups" option is passed in', function(done) {
			Groups.search('hidden', {
				showAllGroups: true
			}, function(err, groups) {
				assert.equal(1, groups.length);
				assert.strictEqual('Hidden', groups[0].name);
				done();
			});
		});
	});

	describe('.isMember()', function() {
		it('should return boolean true when a user is in a group', function(done) {
			Groups.isMember(1, 'Test', function(err, isMember) {
				if (err) return done(err);

				assert.strictEqual(isMember, true);

				done();
			});
		});

		it('should return boolean false when a user is not in a group', function(done) {
			Groups.isMember(2, 'Test', function(err, isMember) {
				if (err) return done(err);

				assert.strictEqual(isMember, false);

				done();
			});
		});
	});

	describe('.isMemberOfGroupList', function() {
		it('should report that a user is part of a groupList, if they are', function(done) {
			Groups.isMemberOfGroupList(1, 'Hidden', function(err, isMember) {
				if (err) return done(err);

				assert.strictEqual(isMember, true);

				done();
			});
		});

		it('should report that a user is not part of a groupList, if they are not', function(done) {
			Groups.isMemberOfGroupList(2, 'Hidden', function(err, isMember) {
				if (err) return done(err);

				assert.strictEqual(isMember, false);

				done();
			});
		});
	});

	describe('.exists()', function() {
		it('should verify that the test group exists', function(done) {
			Groups.exists('Test', function(err, exists) {
				if (err) return done(err);

				assert.strictEqual(exists, true);

				done();
			});
		});

		it('should verify that a fake group does not exist', function(done) {
			Groups.exists('Derp', function(err, exists) {
				if (err) return done(err);

				assert.strictEqual(exists, false);

				done();
			});
		});
	});

	describe('.create()', function() {
		it('should create another group', function(done) {
			Groups.create('foo', 'bar', function(err) {
				if (err) return done(err);

				Groups.get('foo', {}, done);
			});
		});
	});

	describe('.hide()', function() {
		it('should mark the group as hidden', function(done) {
			Groups.hide('foo', function(err) {
				if (err) return done(err);

				Groups.get('foo', {}, function(err, groupObj) {
					if (err) return done(err);

					assert.strictEqual(true, groupObj.hidden);

					done();
				});
			});
		});
	});

	describe('.update()', function() {
		it('should change an aspect of a group', function(done) {
			Groups.update('foo', {
				description: 'baz'
			}, function(err) {
				if (err) return done(err);

				Groups.get('foo', {}, function(err, groupObj) {
					if (err) return done(err);

					assert.strictEqual('baz', groupObj.description);

					done();
				});
			});
		});
	});

	describe('.destroy()', function() {
		before(function(done) {
			Groups.join('foo', 1, done);
		});

		it('should destroy a group', function(done) {
			Groups.destroy('foo', function(err) {
				if (err) return done(err);

				Groups.get('foo', {}, function(err, groupObj) {
					assert(err);
					assert.strictEqual(undefined, groupObj);

					done();
				});
			});
		});

		it('should also remove the members set', function(done) {
			db.exists('group:foo:members', function(err, exists) {
				if (err) return done(err);

				assert.strictEqual(false, exists);

				done();
			});
		});
	});

	describe('.join()', function() {
		before(function(done) {
			Groups.leave('Test', 1, done);
		});

		it('should add a user to a group', function(done) {
			Groups.join('Test', 1, function(err) {
				if (err) return done(err);

				Groups.isMember(1, 'Test', function(err, isMember) {
					assert.strictEqual(true, isMember);

					done();
				});
			});
		});
	});

	describe('.leave()', function() {
		it('should remove a user from a group', function(done) {
			Groups.leave('Test', 1, function(err) {
				if (err) return done(err);

				Groups.isMember(1, 'Test', function(err, isMember) {
					assert.strictEqual(false, isMember);

					done();
				});
			});
		});
	});

	describe('.leaveAllGroups()', function() {
		it('should remove a user from all groups', function(done) {
			Groups.leaveAllGroups(1, function(err) {
				if (err) return done(err);

				var	groups = ['Test', 'Hidden'];
				async.every(groups, function(group, next) {
					Groups.isMember(1, group, function(err, isMember) {
						if (err) done(err);
						else {
							next(!isMember);
						}
					});
				}, function(result) {
					assert(result);

					done();
				});
			});
		});
	});
});

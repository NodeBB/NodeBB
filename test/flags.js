'use strict';

/* globals require, before, after, describe, it */

var assert = require('assert');
var async = require('async');

var db = require('./mocks/databasemock');
var Flags = require('../src/flags');
var Categories = require('../src/categories');
var Topics = require('../src/topics');
var Posts = require('../src/posts');
var User = require('../src/user');
var Groups = require('../src/groups');
var Meta = require('../src/meta');

describe('Flags', function () {
	before(function (done) {
		// Create some stuff to flag
		async.waterfall([
			async.apply(User.create, { username: 'testUser', password: 'abcdef', email: 'b@c.com' }),
			function (uid, next) {
				Categories.create({
					name: 'test category',
				}, function (err, category) {
					if (err) {
						return done(err);
					}

					Topics.post({
						cid: category.cid,
						uid: uid,
						title: 'Topic to flag',
						content: 'This is flaggable content',
					}, next);
				});
			},
			function (topicData, next) {
				User.create({
					username: 'testUser2', password: 'abcdef', email: 'c@d.com',
				}, next);
			},
			function (uid, next) {
				Groups.join('administrators', uid, next);
			},
			function (next) {
				User.create({
					username: 'unprivileged', password: 'abcdef', email: 'd@e.com',
				}, next);
			},
		], done);
	});

	describe('.create()', function () {
		it('should create a flag and return its data', function (done) {
			Flags.create('post', 1, 1, 'Test flag', function (err, flagData) {
				assert.ifError(err);
				var compare = {
					flagId: 1,
					uid: 1,
					targetId: 1,
					type: 'post',
					description: 'Test flag',
				};
				assert(flagData);
				for (var key in compare) {
					if (compare.hasOwnProperty(key)) {
						assert.ok(flagData[key], 'undefined key ' + key);
						assert.equal(flagData[key], compare[key]);
					}
				}

				done();
			});
		});

		it('should add the flag to the byCid zset for category 1 if it is of type post', function (done) {
			db.isSortedSetMember('flags:byCid:' + 1, 1, function (err, isMember) {
				assert.ifError(err);
				assert.ok(isMember);
				done();
			});
		});

		it('should add the flag to the byPid zset for pid 1 if it is of type post', function (done) {
			db.isSortedSetMember('flags:byPid:' + 1, 1, function (err, isMember) {
				assert.ifError(err);
				assert.ok(isMember);
				done();
			});
		});
	});

	describe('.exists()', function () {
		it('should return Boolean True if a flag matching the flag hash already exists', function (done) {
			Flags.exists('post', 1, 1, function (err, exists) {
				assert.ifError(err);
				assert.strictEqual(true, exists);
				done();
			});
		});

		it('should return Boolean False if a flag matching the flag hash does not already exists', function (done) {
			Flags.exists('post', 1, 2, function (err, exists) {
				assert.ifError(err);
				assert.strictEqual(false, exists);
				done();
			});
		});
	});

	describe('.targetExists()', function () {
		it('should return Boolean True if the targeted element exists', function (done) {
			Flags.targetExists('post', 1, function (err, exists) {
				assert.ifError(err);
				assert.strictEqual(true, exists);
				done();
			});
		});

		it('should return Boolean False if the targeted element does not exist', function (done) {
			Flags.targetExists('post', 15, function (err, exists) {
				assert.ifError(err);
				assert.strictEqual(false, exists);
				done();
			});
		});
	});

	describe('.get()', function () {
		it('should retrieve and display a flag\'s data', function (done) {
			Flags.get(1, function (err, flagData) {
				assert.ifError(err);
				var compare = {
					flagId: 1,
					uid: 1,
					targetId: 1,
					type: 'post',
					description: 'Test flag',
					state: 'open',
				};
				assert(flagData);
				for (var key in compare) {
					if (compare.hasOwnProperty(key)) {
						assert.ok(flagData[key], 'undefined key ' + key);
						assert.equal(flagData[key], compare[key]);
					}
				}

				done();
			});
		});
	});

	describe('.list()', function () {
		it('should show a list of flags (with one item)', function (done) {
			Flags.list({}, 1, function (err, payload) {
				assert.ifError(err);
				assert.ok(payload.hasOwnProperty('flags'));
				assert.ok(payload.hasOwnProperty('page'));
				assert.ok(payload.hasOwnProperty('pageCount'));
				assert.ok(Array.isArray(payload.flags));
				assert.equal(payload.flags.length, 1);

				Flags.get(payload.flags[0].flagId, function (err, flagData) {
					assert.ifError(err);
					assert.equal(payload.flags[0].flagId, flagData.flagId);
					assert.equal(payload.flags[0].description, flagData.description);
					done();
				});
			});
		});

		describe('(with filters)', function () {
			it('should return a filtered list of flags if said filters are passed in', function (done) {
				Flags.list({
					state: 'open',
				}, 1, function (err, payload) {
					assert.ifError(err);
					assert.ok(payload.hasOwnProperty('flags'));
					assert.ok(payload.hasOwnProperty('page'));
					assert.ok(payload.hasOwnProperty('pageCount'));
					assert.ok(Array.isArray(payload.flags));
					assert.strictEqual(1, parseInt(payload.flags[0].flagId, 10));
					done();
				});
			});

			it('should return no flags if a filter with no matching flags is used', function (done) {
				Flags.list({
					state: 'rejected',
				}, 1, function (err, payload) {
					assert.ifError(err);
					assert.ok(payload.hasOwnProperty('flags'));
					assert.ok(payload.hasOwnProperty('page'));
					assert.ok(payload.hasOwnProperty('pageCount'));
					assert.ok(Array.isArray(payload.flags));
					assert.strictEqual(0, payload.flags.length);
					done();
				});
			});

			it('should return a flag when filtered by cid 1', function (done) {
				Flags.list({
					cid: 1,
				}, 1, function (err, payload) {
					assert.ifError(err);
					assert.ok(payload.hasOwnProperty('flags'));
					assert.ok(payload.hasOwnProperty('page'));
					assert.ok(payload.hasOwnProperty('pageCount'));
					assert.ok(Array.isArray(payload.flags));
					assert.strictEqual(1, payload.flags.length);
					done();
				});
			});

			it('shouldn\'t return a flag when filtered by cid 2', function (done) {
				Flags.list({
					cid: 2,
				}, 1, function (err, payload) {
					assert.ifError(err);
					assert.ok(payload.hasOwnProperty('flags'));
					assert.ok(payload.hasOwnProperty('page'));
					assert.ok(payload.hasOwnProperty('pageCount'));
					assert.ok(Array.isArray(payload.flags));
					assert.strictEqual(0, payload.flags.length);
					done();
				});
			});

			it('should return a flag when filtered by both cid 1 and 2', function (done) {
				Flags.list({
					cid: [1, 2],
				}, 1, function (err, payload) {
					assert.ifError(err);
					assert.ok(payload.hasOwnProperty('flags'));
					assert.ok(payload.hasOwnProperty('page'));
					assert.ok(payload.hasOwnProperty('pageCount'));
					assert.ok(Array.isArray(payload.flags));
					assert.strictEqual(1, payload.flags.length);
					done();
				});
			});

			it('should return one flag if filtered by both cid 1 and 2 and open state', function (done) {
				Flags.list({
					cid: [1, 2],
					state: 'open',
				}, 1, function (err, payload) {
					assert.ifError(err);
					assert.ok(payload.hasOwnProperty('flags'));
					assert.ok(payload.hasOwnProperty('page'));
					assert.ok(payload.hasOwnProperty('pageCount'));
					assert.ok(Array.isArray(payload.flags));
					assert.strictEqual(1, payload.flags.length);
					done();
				});
			});

			it('should return no flag if filtered by both cid 1 and 2 and non-open state', function (done) {
				Flags.list({
					cid: [1, 2],
					state: 'resolved',
				}, 1, function (err, payload) {
					assert.ifError(err);
					assert.ok(payload.hasOwnProperty('flags'));
					assert.ok(payload.hasOwnProperty('page'));
					assert.ok(payload.hasOwnProperty('pageCount'));
					assert.ok(Array.isArray(payload.flags));
					assert.strictEqual(0, payload.flags.length);
					done();
				});
			});
		});
	});

	describe('.update()', function () {
		it('should alter a flag\'s various attributes and persist them to the database', function (done) {
			Flags.update(1, 1, {
				state: 'wip',
				assignee: 1,
			}, function (err) {
				assert.ifError(err);
				db.getObjectFields('flag:1', ['state', 'assignee'], function (err, data) {
					if (err) {
						throw err;
					}

					assert.strictEqual('wip', data.state);
					assert.ok(!isNaN(parseInt(data.assignee, 10)));
					assert.strictEqual(1, parseInt(data.assignee, 10));
					done();
				});
			});
		});

		it('should persist to the flag\'s history', function (done) {
			Flags.getHistory(1, function (err, history) {
				if (err) {
					throw err;
				}

				history.forEach(function (change) {
					switch (change.attribute) {
					case 'state':
						assert.strictEqual('[[flags:state-wip]]', change.value);
						break;

					case 'assignee':
						assert.strictEqual(1, change.value);
						break;
					}
				});

				done();
			});
		});
	});

	describe('.getTarget()', function () {
		it('should return a post\'s data if queried with type "post"', function (done) {
			Flags.getTarget('post', 1, 1, function (err, data) {
				assert.ifError(err);
				var compare = {
					uid: 1,
					pid: 1,
					content: 'This is flaggable content',
				};

				for (var key in compare) {
					if (compare.hasOwnProperty(key)) {
						assert.ok(data[key]);
						assert.equal(data[key], compare[key]);
					}
				}

				done();
			});
		});

		it('should return a user\'s data if queried with type "user"', function (done) {
			Flags.getTarget('user', 1, 1, function (err, data) {
				assert.ifError(err);
				var compare = {
					uid: 1,
					username: 'testUser',
					email: 'b@c.com',
				};

				for (var key in compare) {
					if (compare.hasOwnProperty(key)) {
						assert.ok(data[key]);
						assert.equal(data[key], compare[key]);
					}
				}

				done();
			});
		});

		it('should return a plain object with no properties if the target no longer exists', function (done) {
			Flags.getTarget('user', 15, 1, function (err, data) {
				assert.ifError(err);
				assert.strictEqual(0, Object.keys(data).length);
				done();
			});
		});
	});

	describe('.validate()', function () {
		it('should error out if type is post and post is deleted', function (done) {
			Posts.delete(1, 1, function (err) {
				if (err) {
					throw err;
				}

				Flags.validate({
					type: 'post',
					id: 1,
					uid: 1,
				}, function (err) {
					assert.ok(err);
					assert.strictEqual('[[error:post-deleted]]', err.message);
					Posts.restore(1, 1, done);
				});
			});
		});

		it('should not pass validation if flag threshold is set and user rep does not meet it', function (done) {
			Meta.configs.set('min:rep:flag', '50', function (err) {
				assert.ifError(err);

				Flags.validate({
					type: 'post',
					id: 1,
					uid: 3,
				}, function (err) {
					assert.ok(err);
					assert.strictEqual('[[error:not-enough-reputation-to-flag]]', err.message);
					Meta.configs.set('min:rep:flag', 0, done);
				});
			});
		});
	});

	describe('.appendNote()', function () {
		it('should add a note to a flag', function (done) {
			Flags.appendNote(1, 1, 'this is my note', function (err) {
				assert.ifError(err);

				db.getSortedSetRange('flag:1:notes', 0, -1, function (err, notes) {
					if (err) {
						throw err;
					}

					assert.strictEqual('[1,"this is my note"]', notes[0]);
					done();
				});
			});
		});

		it('should be a JSON string', function (done) {
			db.getSortedSetRange('flag:1:notes', 0, -1, function (err, notes) {
				if (err) {
					throw err;
				}

				try {
					JSON.parse(notes[0]);
				} catch (e) {
					assert.ifError(e);
				}

				done();
			});
		});
	});

	describe('.getNotes()', function () {
		before(function (done) {
			// Add a second note
			Flags.appendNote(1, 1, 'this is the second note', done);
		});

		it('return should match a predefined spec', function (done) {
			Flags.getNotes(1, function (err, notes) {
				assert.ifError(err);
				var compare = {
					uid: 1,
					content: 'this is my note',
				};

				var data = notes[1];
				for (var key in compare) {
					if (compare.hasOwnProperty(key)) {
						assert.ok(data[key]);
						assert.strictEqual(data[key], compare[key]);
					}
				}

				done();
			});
		});

		it('should retrieve a list of notes, from newest to oldest', function (done) {
			Flags.getNotes(1, function (err, notes) {
				assert.ifError(err);
				assert(notes[0].datetime > notes[1].datetime, notes[0].datetime + '-' + notes[1].datetime);
				assert.strictEqual('this is the second note', notes[0].content);
				done();
			});
		});
	});

	describe('.appendHistory()', function () {
		var entries;
		before(function (done) {
			db.sortedSetCard('flag:1:history', function (err, count) {
				entries = count;
				done(err);
			});
		});

		it('should add a new entry into a flag\'s history', function (done) {
			Flags.appendHistory(1, 1, {
				state: 'rejected',
			}, function (err) {
				assert.ifError(err);

				Flags.getHistory(1, function (err, history) {
					if (err) {
						throw err;
					}

					assert.strictEqual(entries + 1, history.length);
					done();
				});
			});
		});
	});

	describe('.getHistory()', function () {
		it('should retrieve a flag\'s history', function (done) {
			Flags.getHistory(1, function (err, history) {
				assert.ifError(err);
				assert.strictEqual(history[0].fields.state, '[[flags:state-rejected]]');
				done();
			});
		});
	});

	describe('(websockets)', function () {
		var SocketFlags = require('../src/socket.io/flags.js');
		var tid;
		var pid;
		var flag;

		before(function (done) {
			Topics.post({
				cid: 1,
				uid: 1,
				title: 'Another topic',
				content: 'This is flaggable content',
			}, function (err, topic) {
				tid = topic.postData.tid;
				pid = topic.postData.pid;

				done(err);
			});
		});

		describe('.create()', function () {
			it('should create a flag with no errors', function (done) {
				SocketFlags.create({ uid: 2 }, {
					type: 'post',
					id: pid,
					reason: 'foobar',
				}, function (err, flagObj) {
					flag = flagObj;
					assert.ifError(err);

					Flags.exists('post', pid, 1, function (err, exists) {
						assert.ifError(err);
						assert(true);
						done();
					});
				});
			});
		});

		describe('.update()', function () {
			it('should update a flag\'s properties', function (done) {
				SocketFlags.update({ uid: 2 }, {
					flagId: 2,
					data: [{
						name: 'state',
						value: 'wip',
					}],
				}, function (err, history) {
					assert.ifError(err);
					assert(Array.isArray(history));
					assert(history[0].fields.hasOwnProperty('state'));
					assert.strictEqual('[[flags:state-wip]]', history[0].fields.state);
					done();
				});
			});
		});

		describe('.appendNote()', function () {
			it('should append a note to the flag', function (done) {
				SocketFlags.appendNote({ uid: 2 }, {
					flagId: 2,
					note: 'lorem ipsum dolor sit amet',
				}, function (err, data) {
					assert.ifError(err);
					assert(data.hasOwnProperty('notes'));
					assert(Array.isArray(data.notes));
					assert.strictEqual('lorem ipsum dolor sit amet', data.notes[0].content);
					assert.strictEqual(2, data.notes[0].uid);

					assert(data.hasOwnProperty('history'));
					assert(Array.isArray(data.history));
					assert.strictEqual(1, Object.keys(data.history[0].fields).length);
					assert(data.history[0].fields.hasOwnProperty('notes'));
					done();
				});
			});
		});
	});
});

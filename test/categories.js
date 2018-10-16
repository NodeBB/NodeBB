'use strict';


var async = require('async');
var assert = require('assert');
var nconf = require('nconf');
var request = require('request');

var db = require('./mocks/databasemock');
var Categories = require('../src/categories');
var Topics = require('../src/topics');
var User = require('../src/user');
var groups = require('../src/groups');
var privileges = require('../src/privileges');

describe('Categories', function () {
	var categoryObj;
	var posterUid;
	var adminUid;

	before(function (done) {
		async.series({
			posterUid: function (next) {
				User.create({ username: 'poster' }, next);
			},
			adminUid: function (next) {
				User.create({ username: 'admin' }, next);
			},
		}, function (err, results) {
			assert.ifError(err);
			posterUid = results.posterUid;
			adminUid = results.adminUid;
			groups.join('administrators', adminUid, done);
		});
	});


	it('should create a new category', function (done) {
		Categories.create({
			name: 'Test Category',
			description: 'Test category created by testing script',
			icon: 'fa-check',
			blockclass: 'category-blue',
			order: '5',
		}, function (err, category) {
			assert.ifError(err);

			categoryObj = category;
			done();
		});
	});

	it('should retrieve a newly created category by its ID', function (done) {
		Categories.getCategoryById({
			cid: categoryObj.cid,
			start: 0,
			stop: -1,
			uid: 0,
		}, function (err, categoryData) {
			assert.equal(err, null);

			assert(categoryData);
			assert.equal(categoryObj.name, categoryData.name);
			assert.equal(categoryObj.description, categoryData.description);

			done();
		});
	});


	it('should load a category route', function (done) {
		request(nconf.get('url') + '/category/' + categoryObj.cid + '/test-category', function (err, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 200);
			assert(body);
			done();
		});
	});

	describe('Categories.getRecentTopicReplies', function () {
		it('should not throw', function (done) {
			Categories.getCategoryById({
				cid: categoryObj.cid,
				set: 'cid:' + categoryObj.cid + ':tids',
				reverse: true,
				start: 0,
				stop: -1,
				uid: 0,
			}, function (err, categoryData) {
				assert.ifError(err);
				Categories.getRecentTopicReplies(categoryData, 0, function (err) {
					assert.ifError(err);
					done();
				});
			});
		});
	});

	describe('.getCategoryTopics', function () {
		it('should return a list of topics', function (done) {
			Categories.getCategoryTopics({
				cid: categoryObj.cid,
				start: 0,
				stop: 10,
				uid: 0,
				sort: 'oldest-to-newest',
			}, function (err, result) {
				assert.equal(err, null);

				assert(Array.isArray(result.topics));
				assert(result.topics.every(function (topic) {
					return topic instanceof Object;
				}));

				done();
			});
		});

		it('should return a list of topics by a specific user', function (done) {
			Categories.getCategoryTopics({
				cid: categoryObj.cid,
				start: 0,
				stop: 10,
				uid: 0,
				targetUid: 1,
				sort: 'oldest-to-newest',
			}, function (err, result) {
				assert.equal(err, null);
				assert(Array.isArray(result.topics));
				assert(result.topics.every(function (topic) {
					return topic instanceof Object && topic.uid === '1';
				}));

				done();
			});
		});
	});

	describe('Categories.moveRecentReplies', function () {
		var moveCid;
		var moveTid;
		before(function (done) {
			async.parallel({
				category: function (next) {
					Categories.create({
						name: 'Test Category 2',
						description: 'Test category created by testing script',
					}, next);
				},
				topic: function (next) {
					Topics.post({
						uid: posterUid,
						cid: categoryObj.cid,
						title: 'Test Topic Title',
						content: 'The content of test topic',
					}, next);
				},
			}, function (err, results) {
				if (err) {
					return done(err);
				}
				moveCid = results.category.cid;
				moveTid = results.topic.topicData.tid;
				Topics.reply({ uid: posterUid, content: 'test post', tid: moveTid }, function (err) {
					done(err);
				});
			});
		});

		it('should move posts from one category to another', function (done) {
			Categories.moveRecentReplies(moveTid, categoryObj.cid, moveCid, function (err) {
				assert.ifError(err);
				db.getSortedSetRange('cid:' + categoryObj.cid + ':pids', 0, -1, function (err, pids) {
					assert.ifError(err);
					assert.equal(pids.length, 0);
					db.getSortedSetRange('cid:' + moveCid + ':pids', 0, -1, function (err, pids) {
						assert.ifError(err);
						assert.equal(pids.length, 2);
						done();
					});
				});
			});
		});
	});

	describe('socket methods', function () {
		var socketCategories = require('../src/socket.io/categories');

		before(function (done) {
			Topics.post({
				uid: posterUid,
				cid: categoryObj.cid,
				title: 'Test Topic Title',
				content: 'The content of test topic',
				tags: ['nodebb'],
			}, done);
		});

		it('should get recent replies in category', function (done) {
			socketCategories.getRecentReplies({ uid: posterUid }, categoryObj.cid, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should get categories', function (done) {
			socketCategories.get({ uid: posterUid }, {}, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should get watched categories', function (done) {
			socketCategories.getWatchedCategories({ uid: posterUid }, {}, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should load more topics', function (done) {
			socketCategories.loadMore({ uid: posterUid }, {
				cid: categoryObj.cid,
				after: 0,
				query: {
					author: 'poster',
					tag: 'nodebb',
				},
			}, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data.topics));
				assert.equal(data.topics[0].user.username, 'poster');
				assert.equal(data.topics[0].tags[0].value, 'nodebb');
				assert.equal(data.topics[0].category.cid, categoryObj.cid);
				done();
			});
		});

		it('should load page count', function (done) {
			socketCategories.getPageCount({ uid: posterUid }, categoryObj.cid, function (err, pageCount) {
				assert.ifError(err);
				assert.equal(pageCount, 1);
				done();
			});
		});

		it('should load topic count', function (done) {
			socketCategories.getTopicCount({ uid: posterUid }, categoryObj.cid, function (err, topicCount) {
				assert.ifError(err);
				assert.equal(topicCount, 2);
				done();
			});
		});

		it('should load category by privilege', function (done) {
			socketCategories.getCategoriesByPrivilege({ uid: posterUid }, 'find', function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should get move categories', function (done) {
			socketCategories.getMoveCategories({ uid: posterUid }, {}, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should ignore category', function (done) {
			socketCategories.ignore({ uid: posterUid }, categoryObj.cid, function (err) {
				assert.ifError(err);
				Categories.isIgnored([categoryObj.cid], posterUid, function (err, isIgnored) {
					assert.ifError(err);
					assert.equal(isIgnored[0], true);
					done();
				});
			});
		});

		it('should watch category', function (done) {
			socketCategories.watch({ uid: posterUid }, categoryObj.cid, function (err) {
				assert.ifError(err);
				Categories.isIgnored([categoryObj.cid], posterUid, function (err, isIgnored) {
					assert.ifError(err);
					assert.equal(isIgnored[0], false);
					done();
				});
			});
		});

		it('should check if user is moderator', function (done) {
			socketCategories.isModerator({ uid: posterUid }, {}, function (err, isModerator) {
				assert.ifError(err);
				assert(!isModerator);
				done();
			});
		});

		it('should get category data', function (done) {
			socketCategories.getCategory({ uid: posterUid }, categoryObj.cid, function (err, data) {
				assert.ifError(err);
				assert.equal(categoryObj.cid, data.cid);
				done();
			});
		});
	});

	describe('admin socket methods', function () {
		var socketCategories = require('../src/socket.io/admin/categories');
		var cid;
		before(function (done) {
			socketCategories.create({ uid: adminUid }, {
				name: 'update name',
				description: 'update description',
				parentCid: categoryObj.cid,
				icon: 'fa-check',
				order: '5',
			}, function (err, category) {
				assert.ifError(err);

				cid = category.cid;
				done();
			});
		});

		it('should return error with invalid data', function (done) {
			socketCategories.update({ uid: adminUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error if you try to set parent as self', function (done) {
			var updateData = {};
			updateData[cid] = {
				parentCid: cid,
			};
			socketCategories.update({ uid: adminUid }, updateData, function (err) {
				assert.equal(err.message, '[[error:cant-set-self-as-parent]]');
				done();
			});
		});

		it('should update category data', function (done) {
			var updateData = {};
			updateData[cid] = {
				name: 'new name',
				description: 'new description',
				parentCid: 0,
				order: 3,
				icon: 'fa-hammer',
			};
			socketCategories.update({ uid: adminUid }, updateData, function (err) {
				assert.ifError(err);
				Categories.getCategoryData(cid, function (err, data) {
					assert.ifError(err);
					assert.equal(data.name, updateData[cid].name);
					assert.equal(data.description, updateData[cid].description);
					assert.equal(data.parentCid, updateData[cid].parentCid);
					assert.equal(data.order, updateData[cid].order);
					assert.equal(data.icon, updateData[cid].icon);
					done();
				});
			});
		});

		it('should purge category', function (done) {
			Categories.create({
				name: 'purge me',
				description: 'update description',
			}, function (err, category) {
				assert.ifError(err);
				Topics.post({
					uid: posterUid,
					cid: category.cid,
					title: 'Test Topic Title',
					content: 'The content of test topic',
				}, function (err) {
					assert.ifError(err);
					socketCategories.purge({ uid: adminUid }, category.cid, function (err) {
						assert.ifError(err);
						done();
					});
				});
			});
		});

		it('should get all categories', function (done) {
			socketCategories.getAll({ uid: adminUid }, {}, function (err, data) {
				assert.ifError(err);
				assert(data);
				done();
			});
		});

		it('should get all category names', function (done) {
			socketCategories.getNames({ uid: adminUid }, {}, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should give privilege', function (done) {
			socketCategories.setPrivilege({ uid: adminUid }, { cid: categoryObj.cid, privilege: ['groups:topics:delete'], set: true, member: 'registered-users' }, function (err) {
				assert.ifError(err);
				privileges.categories.can('topics:delete', categoryObj.cid, posterUid, function (err, canDeleteTopcis) {
					assert.ifError(err);
					assert(canDeleteTopcis);
					done();
				});
			});
		});

		it('should remove privilege', function (done) {
			socketCategories.setPrivilege({ uid: adminUid }, { cid: categoryObj.cid, privilege: 'groups:topics:delete', set: false, member: 'registered-users' }, function (err) {
				assert.ifError(err);
				privileges.categories.can('topics:delete', categoryObj.cid, posterUid, function (err, canDeleteTopcis) {
					assert.ifError(err);
					assert(!canDeleteTopcis);
					done();
				});
			});
		});

		it('should get privilege settings', function (done) {
			socketCategories.getPrivilegeSettings({ uid: adminUid }, categoryObj.cid, function (err, data) {
				assert.ifError(err);
				assert(data);
				done();
			});
		});

		it('should copy privileges to children', function (done) {
			var parentCid;
			var child1Cid;
			var child2Cid;
			async.waterfall([
				function (next) {
					Categories.create({ name: 'parent' }, next);
				},
				function (category, next) {
					parentCid = category.cid;
					Categories.create({ name: 'child1', parentCid: parentCid }, next);
				},
				function (category, next) {
					child1Cid = category.cid;
					Categories.create({ name: 'child2', parentCid: child1Cid }, next);
				},
				function (category, next) {
					child2Cid = category.cid;
					socketCategories.setPrivilege({ uid: adminUid }, { cid: parentCid, privilege: 'groups:topics:delete', set: true, member: 'registered-users' }, next);
				},
				function (next) {
					socketCategories.copyPrivilegesToChildren({ uid: adminUid }, parentCid, next);
				},
				function (next) {
					privileges.categories.can('topics:delete', child2Cid, posterUid, next);
				},
				function (canDelete, next) {
					assert(canDelete);
					next();
				},
			], done);
		});

		it('should copy settings from', function (done) {
			var child1Cid;
			var parentCid;
			async.waterfall([
				function (next) {
					Categories.create({ name: 'parent', description: 'copy me' }, next);
				},
				function (category, next) {
					parentCid = category.cid;
					Categories.create({ name: 'child1' }, next);
				},
				function (category, next) {
					child1Cid = category.cid;
					socketCategories.copySettingsFrom({ uid: adminUid }, { fromCid: parentCid, toCid: child1Cid }, next);
				},
				function (canDelete, next) {
					Categories.getCategoryField(child1Cid, 'description', next);
				},
				function (description, next) {
					assert.equal(description, 'copy me');
					next();
				},
			], done);
		});

		it('should copy privileges from', function (done) {
			var child1Cid;
			var parentCid;
			async.waterfall([
				function (next) {
					Categories.create({ name: 'parent', description: 'copy me' }, next);
				},
				function (category, next) {
					parentCid = category.cid;
					Categories.create({ name: 'child1' }, next);
				},
				function (category, next) {
					child1Cid = category.cid;
					socketCategories.setPrivilege({ uid: adminUid }, { cid: parentCid, privilege: 'groups:topics:delete', set: true, member: 'registered-users' }, next);
				},
				function (next) {
					socketCategories.copyPrivilegesFrom({ uid: adminUid }, { fromCid: parentCid, toCid: child1Cid }, next);
				},
				function (next) {
					privileges.categories.can('topics:delete', child1Cid, posterUid, next);
				},
				function (canDelete, next) {
					assert(canDelete);
					next();
				},
			], done);
		});
	});

	it('should get active users', function (done) {
		Categories.create({
			name: 'test',
		}, function (err, category) {
			assert.ifError(err);
			Topics.post({
				uid: posterUid,
				cid: category.cid,
				title: 'Test Topic Title',
				content: 'The content of test topic',
			}, function (err) {
				assert.ifError(err);
				Categories.getActiveUsers(category.cid, function (err, uids) {
					assert.ifError(err);
					assert.equal(uids[0], posterUid);
					done();
				});
			});
		});
	});

	describe('tag whitelist', function () {
		var cid;
		var socketTopics = require('../src/socket.io/topics');
		before(function (done) {
			Categories.create({
				name: 'test',
			}, function (err, category) {
				assert.ifError(err);
				cid = category.cid;
				done();
			});
		});

		it('should error if data is invalid', function (done) {
			socketTopics.isTagAllowed({ uid: posterUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should return true if category whitelist is empty', function (done) {
			socketTopics.isTagAllowed({ uid: posterUid }, { tag: 'notallowed', cid: cid }, function (err, allowed) {
				assert.ifError(err);
				assert(allowed);
				done();
			});
		});

		it('should add tags to category whitelist', function (done) {
			var data = {};
			data[cid] = {
				tagWhitelist: 'nodebb,jquery,javascript',
			};
			Categories.update(data, function (err) {
				assert.ifError(err);
				db.getSortedSetRange('cid:' + cid + ':tag:whitelist', 0, -1, function (err, tagWhitelist) {
					assert.ifError(err);
					assert.deepEqual(['nodebb', 'jquery', 'javascript'], tagWhitelist);
					done();
				});
			});
		});

		it('should return false if category whitelist does not have tag', function (done) {
			socketTopics.isTagAllowed({ uid: posterUid }, { tag: 'notallowed', cid: cid }, function (err, allowed) {
				assert.ifError(err);
				assert(!allowed);
				done();
			});
		});

		it('should return true if category whitelist has tag', function (done) {
			socketTopics.isTagAllowed({ uid: posterUid }, { tag: 'nodebb', cid: cid }, function (err, allowed) {
				assert.ifError(err);
				assert(allowed);
				done();
			});
		});

		it('should post a topic with only allowed tags', function (done) {
			Topics.post({
				uid: posterUid,
				cid: cid,
				title: 'Test Topic Title',
				content: 'The content of test topic',
				tags: ['nodebb', 'jquery', 'notallowed'],
			}, function (err, data) {
				assert.ifError(err);
				assert.equal(data.topicData.tags.length, 2);
				done();
			});
		});
	});


	describe('privileges', function () {
		var privileges = require('../src/privileges');

		it('should return empty array if uids is empty array', function (done) {
			privileges.categories.filterUids('find', categoryObj.cid, [], function (err, uids) {
				assert.ifError(err);
				assert.equal(uids.length, 0);
				done();
			});
		});

		it('should filter uids by privilege', function (done) {
			privileges.categories.filterUids('find', categoryObj.cid, [1, 2, 3, 4], function (err, uids) {
				assert.ifError(err);
				assert.deepEqual(uids, [1, 2]);
				done();
			});
		});

		it('should load category user privileges', function (done) {
			privileges.categories.userPrivileges(categoryObj.cid, 1, function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, {
					find: false,
					'posts:delete': false,
					read: false,
					'topics:reply': false,
					'topics:read': false,
					'topics:create': false,
					'topics:tag': false,
					'topics:delete': false,
					'posts:edit': false,
					'posts:history': false,
					'posts:upvote': false,
					'posts:downvote': false,
					purge: false,
					'posts:view_deleted': false,
					moderate: false,
				});

				done();
			});
		});

		it('should load global user privileges', function (done) {
			privileges.global.userPrivileges(1, function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, {
					ban: false,
					chat: false,
					'search:content': false,
					'search:users': false,
					'search:tags': false,
					'upload:post:image': false,
					'upload:post:file': false,
					signature: false,
					'local:login': false,
				});

				done();
			});
		});

		it('should load category group privileges', function (done) {
			privileges.categories.groupPrivileges(categoryObj.cid, 'registered-users', function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, {
					'groups:find': true,
					'groups:posts:edit': true,
					'groups:posts:history': true,
					'groups:posts:upvote': true,
					'groups:posts:downvote': true,
					'groups:topics:delete': false,
					'groups:topics:create': true,
					'groups:topics:reply': true,
					'groups:topics:tag': true,
					'groups:posts:delete': true,
					'groups:read': true,
					'groups:topics:read': true,
					'groups:purge': false,
					'groups:posts:view_deleted': false,
					'groups:moderate': false,
				});

				done();
			});
		});

		it('should load global group privileges', function (done) {
			privileges.global.groupPrivileges('registered-users', function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, {
					'groups:ban': false,
					'groups:chat': true,
					'groups:search:content': true,
					'groups:search:users': true,
					'groups:search:tags': true,
					'groups:upload:post:image': true,
					'groups:upload:post:file': false,
					'groups:signature': true,
					'groups:local:login': true,
				});

				done();
			});
		});

		it('should return false if cid is falsy', function (done) {
			privileges.categories.isUserAllowedTo('find', null, adminUid, function (err, isAllowed) {
				assert.ifError(err);
				assert.equal(isAllowed, false);
				done();
			});
		});
	});


	describe('getTopicIds', function () {
		var plugins = require('../src/plugins');
		it('should get topic ids with filter', function (done) {
			function method(data, callback) {
				data.tids = [1, 2, 3];
				callback(null, data);
			}

			plugins.registerHook('my-test-plugin', {
				hook: 'filter:categories.getTopicIds',
				method: method,
			});

			Categories.getTopicIds({
				cid: categoryObj.cid,
				start: 0,
				stop: 19,
			}, function (err, tids) {
				assert.ifError(err);
				assert.deepEqual(tids, [1, 2, 3]);
				plugins.unregisterHook('my-test-plugin', 'filter:categories.getTopicIds', method);
				done();
			});
		});
	});
});

'use strict';


const async = require('async');
const assert = require('assert');
const nconf = require('nconf');
const request = require('request');

const db = require('./mocks/databasemock');
const Categories = require('../src/categories');
const Topics = require('../src/topics');
const User = require('../src/user');
const groups = require('../src/groups');
const privileges = require('../src/privileges');

describe('Categories', () => {
	let categoryObj;
	let posterUid;
	let adminUid;

	before((done) => {
		async.series({
			posterUid: function (next) {
				User.create({ username: 'poster' }, next);
			},
			adminUid: function (next) {
				User.create({ username: 'admin' }, next);
			},
		}, (err, results) => {
			assert.ifError(err);
			posterUid = results.posterUid;
			adminUid = results.adminUid;
			groups.join('administrators', adminUid, done);
		});
	});


	it('should create a new category', (done) => {
		Categories.create({
			name: 'Test Category & NodeBB',
			description: 'Test category created by testing script',
			icon: 'fa-check',
			blockclass: 'category-blue',
			order: '5',
		}, (err, category) => {
			assert.ifError(err);

			categoryObj = category;
			done();
		});
	});

	it('should retrieve a newly created category by its ID', (done) => {
		Categories.getCategoryById({
			cid: categoryObj.cid,
			start: 0,
			stop: -1,
			uid: 0,
		}, (err, categoryData) => {
			assert.ifError(err);

			assert(categoryData);
			assert.equal('Test Category &amp; NodeBB', categoryData.name);
			assert.equal(categoryObj.description, categoryData.description);
			assert.strictEqual(categoryObj.disabled, 0);
			done();
		});
	});

	it('should return null if category does not exist', (done) => {
		Categories.getCategoryById({
			cid: 123123123,
			start: 0,
			stop: -1,
		}, (err, categoryData) => {
			assert.ifError(err);
			assert.strictEqual(categoryData, null);
			done();
		});
	});

	it('should get all categories', (done) => {
		Categories.getAllCategories(1, (err, data) => {
			assert.ifError(err);
			assert(Array.isArray(data));
			assert.equal(data[0].cid, categoryObj.cid);
			done();
		});
	});

	it('should load a category route', (done) => {
		request(`${nconf.get('url')}/api/category/${categoryObj.cid}/test-category`, { json: true }, (err, response, body) => {
			assert.ifError(err);
			assert.equal(response.statusCode, 200);
			assert.equal(body.name, 'Test Category &amp; NodeBB');
			assert(body);
			done();
		});
	});

	describe('Categories.getRecentTopicReplies', () => {
		it('should not throw', (done) => {
			Categories.getCategoryById({
				cid: categoryObj.cid,
				set: `cid:${categoryObj.cid}:tids`,
				reverse: true,
				start: 0,
				stop: -1,
				uid: 0,
			}, (err, categoryData) => {
				assert.ifError(err);
				Categories.getRecentTopicReplies(categoryData, 0, {}, (err) => {
					assert.ifError(err);
					done();
				});
			});
		});
	});

	describe('.getCategoryTopics', () => {
		it('should return a list of topics', (done) => {
			Categories.getCategoryTopics({
				cid: categoryObj.cid,
				start: 0,
				stop: 10,
				uid: 0,
				sort: 'oldest_to_newest',
			}, (err, result) => {
				assert.equal(err, null);

				assert(Array.isArray(result.topics));
				assert(result.topics.every(topic => topic instanceof Object));

				done();
			});
		});

		it('should return a list of topics by a specific user', (done) => {
			Categories.getCategoryTopics({
				cid: categoryObj.cid,
				start: 0,
				stop: 10,
				uid: 0,
				targetUid: 1,
				sort: 'oldest_to_newest',
			}, (err, result) => {
				assert.equal(err, null);
				assert(Array.isArray(result.topics));
				assert(result.topics.every(topic => topic instanceof Object && topic.uid === '1'));

				done();
			});
		});
	});

	describe('Categories.moveRecentReplies', () => {
		let moveCid;
		let moveTid;
		before((done) => {
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
			}, (err, results) => {
				if (err) {
					return done(err);
				}
				moveCid = results.category.cid;
				moveTid = results.topic.topicData.tid;
				Topics.reply({ uid: posterUid, content: 'test post', tid: moveTid }, (err) => {
					done(err);
				});
			});
		});

		it('should move posts from one category to another', (done) => {
			Categories.moveRecentReplies(moveTid, categoryObj.cid, moveCid, (err) => {
				assert.ifError(err);
				db.getSortedSetRange(`cid:${categoryObj.cid}:pids`, 0, -1, (err, pids) => {
					assert.ifError(err);
					assert.equal(pids.length, 0);
					db.getSortedSetRange(`cid:${moveCid}:pids`, 0, -1, (err, pids) => {
						assert.ifError(err);
						assert.equal(pids.length, 2);
						done();
					});
				});
			});
		});
	});

	describe('socket methods', () => {
		const socketCategories = require('../src/socket.io/categories');

		before((done) => {
			Topics.post({
				uid: posterUid,
				cid: categoryObj.cid,
				title: 'Test Topic Title',
				content: 'The content of test topic',
				tags: ['nodebb'],
			}, done);
		});

		it('should get recent replies in category', (done) => {
			socketCategories.getRecentReplies({ uid: posterUid }, categoryObj.cid, (err, data) => {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should get categories', (done) => {
			socketCategories.get({ uid: posterUid }, {}, (err, data) => {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should get watched categories', (done) => {
			socketCategories.getWatchedCategories({ uid: posterUid }, {}, (err, data) => {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should load more topics', (done) => {
			socketCategories.loadMore({ uid: posterUid }, {
				cid: categoryObj.cid,
				after: 0,
				query: {
					author: 'poster',
					tag: 'nodebb',
				},
			}, (err, data) => {
				assert.ifError(err);
				assert(Array.isArray(data.topics));
				assert.equal(data.topics[0].user.username, 'poster');
				assert.equal(data.topics[0].tags[0].value, 'nodebb');
				assert.equal(data.topics[0].category.cid, categoryObj.cid);
				done();
			});
		});

		it('should load topic count', (done) => {
			socketCategories.getTopicCount({ uid: posterUid }, categoryObj.cid, (err, topicCount) => {
				assert.ifError(err);
				assert.equal(topicCount, 2);
				done();
			});
		});

		it('should load category by privilege', (done) => {
			socketCategories.getCategoriesByPrivilege({ uid: posterUid }, 'find', (err, data) => {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should get move categories', (done) => {
			socketCategories.getMoveCategories({ uid: posterUid }, {}, (err, data) => {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should ignore category', (done) => {
			socketCategories.ignore({ uid: posterUid }, { cid: categoryObj.cid }, (err) => {
				assert.ifError(err);
				Categories.isIgnored([categoryObj.cid], posterUid, (err, isIgnored) => {
					assert.ifError(err);
					assert.equal(isIgnored[0], true);
					Categories.getIgnorers(categoryObj.cid, 0, -1, (err, ignorers) => {
						assert.ifError(err);
						assert.deepEqual(ignorers, [posterUid]);
						done();
					});
				});
			});
		});

		it('should watch category', (done) => {
			socketCategories.watch({ uid: posterUid }, { cid: categoryObj.cid }, (err) => {
				assert.ifError(err);
				Categories.isIgnored([categoryObj.cid], posterUid, (err, isIgnored) => {
					assert.ifError(err);
					assert.equal(isIgnored[0], false);
					done();
				});
			});
		});

		it('should error if watch state does not exist', (done) => {
			socketCategories.setWatchState({ uid: posterUid }, { cid: categoryObj.cid, state: 'invalid-state' }, (err) => {
				assert.equal(err.message, '[[error:invalid-watch-state]]');
				done();
			});
		});

		it('should check if user is moderator', (done) => {
			socketCategories.isModerator({ uid: posterUid }, {}, (err, isModerator) => {
				assert.ifError(err);
				assert(!isModerator);
				done();
			});
		});

		it('should get category data', (done) => {
			socketCategories.getCategory({ uid: posterUid }, categoryObj.cid, (err, data) => {
				assert.ifError(err);
				assert.equal(categoryObj.cid, data.cid);
				done();
			});
		});
	});

	describe('admin socket methods', () => {
		const socketCategories = require('../src/socket.io/admin/categories');
		let cid;
		before((done) => {
			socketCategories.create({ uid: adminUid }, {
				name: 'update name',
				description: 'update description',
				parentCid: categoryObj.cid,
				icon: 'fa-check',
				order: '5',
			}, (err, category) => {
				assert.ifError(err);

				cid = category.cid;
				done();
			});
		});

		it('should return error with invalid data', (done) => {
			socketCategories.update({ uid: adminUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error if you try to set parent as self', (done) => {
			const updateData = {};
			updateData[cid] = {
				parentCid: cid,
			};
			socketCategories.update({ uid: adminUid }, updateData, (err) => {
				assert.equal(err.message, '[[error:cant-set-self-as-parent]]');
				done();
			});
		});

		it('should error if you try to set child as parent', (done) => {
			let child1Cid;
			let parentCid;
			async.waterfall([
				function (next) {
					Categories.create({ name: 'parent 1', description: 'poor parent' }, next);
				},
				function (category, next) {
					parentCid = category.cid;
					Categories.create({ name: 'child1', description: 'wanna be parent', parentCid: parentCid }, next);
				},
				function (category, next) {
					child1Cid = category.cid;
					const updateData = {};
					updateData[parentCid] = {
						parentCid: child1Cid,
					};
					socketCategories.update({ uid: adminUid }, updateData, (err) => {
						assert.equal(err.message, '[[error:cant-set-child-as-parent]]');
						next();
					});
				},
			], done);
		});

		it('should update category data', (done) => {
			const updateData = {};
			updateData[cid] = {
				name: 'new name',
				description: 'new description',
				parentCid: 0,
				order: 3,
				icon: 'fa-hammer',
			};
			socketCategories.update({ uid: adminUid }, updateData, (err) => {
				assert.ifError(err);
				Categories.getCategoryData(cid, (err, data) => {
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

		it('should purge category', (done) => {
			Categories.create({
				name: 'purge me',
				description: 'update description',
			}, (err, category) => {
				assert.ifError(err);
				Topics.post({
					uid: posterUid,
					cid: category.cid,
					title: 'Test Topic Title',
					content: 'The content of test topic',
				}, (err) => {
					assert.ifError(err);
					socketCategories.purge({ uid: adminUid }, category.cid, (err) => {
						assert.ifError(err);
						done();
					});
				});
			});
		});

		it('should get all categories', (done) => {
			socketCategories.getAll({ uid: adminUid }, {}, (err, data) => {
				assert.ifError(err);
				assert(data);
				done();
			});
		});

		it('should get all category names', (done) => {
			socketCategories.getNames({ uid: adminUid }, {}, (err, data) => {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should give privilege', (done) => {
			socketCategories.setPrivilege({ uid: adminUid }, { cid: categoryObj.cid, privilege: ['groups:topics:delete'], set: true, member: 'registered-users' }, (err) => {
				assert.ifError(err);
				privileges.categories.can('topics:delete', categoryObj.cid, posterUid, (err, canDeleteTopcis) => {
					assert.ifError(err);
					assert(canDeleteTopcis);
					done();
				});
			});
		});

		it('should remove privilege', (done) => {
			socketCategories.setPrivilege({ uid: adminUid }, { cid: categoryObj.cid, privilege: 'groups:topics:delete', set: false, member: 'registered-users' }, (err) => {
				assert.ifError(err);
				privileges.categories.can('topics:delete', categoryObj.cid, posterUid, (err, canDeleteTopcis) => {
					assert.ifError(err);
					assert(!canDeleteTopcis);
					done();
				});
			});
		});

		it('should get privilege settings', (done) => {
			socketCategories.getPrivilegeSettings({ uid: adminUid }, categoryObj.cid, (err, data) => {
				assert.ifError(err);
				assert(data);
				done();
			});
		});

		it('should copy privileges to children', (done) => {
			let parentCid;
			let child1Cid;
			let child2Cid;
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
					socketCategories.copyPrivilegesToChildren({ uid: adminUid }, { cid: parentCid, group: '' }, next);
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

		it('should create category with settings from', (done) => {
			let child1Cid;
			let parentCid;
			async.waterfall([
				function (next) {
					Categories.create({ name: 'copy from', description: 'copy me' }, next);
				},
				function (category, next) {
					parentCid = category.cid;
					Categories.create({ name: 'child1', description: 'will be gone', cloneFromCid: parentCid }, next);
				},
				function (category, next) {
					child1Cid = category.cid;
					assert.equal(category.description, 'copy me');
					next();
				},
			], done);
		});

		it('should copy settings from', (done) => {
			let child1Cid;
			let parentCid;
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
					socketCategories.copySettingsFrom({ uid: adminUid }, { fromCid: parentCid, toCid: child1Cid, copyParent: true }, next);
				},
				function (destinationCategory, next) {
					Categories.getCategoryField(child1Cid, 'description', next);
				},
				function (description, next) {
					assert.equal(description, 'copy me');
					next();
				},
			], done);
		});

		it('should copy privileges from another category', (done) => {
			let child1Cid;
			let parentCid;
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

		it('should copy privileges from another category for a single group', (done) => {
			let child1Cid;
			let parentCid;
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
					socketCategories.copyPrivilegesFrom({ uid: adminUid }, { fromCid: parentCid, toCid: child1Cid, group: 'registered-users' }, next);
				},
				function (next) {
					privileges.categories.can('topics:delete', child1Cid, 0, next);
				},
				function (canDelete, next) {
					assert(!canDelete);
					next();
				},
			], done);
		});
	});

	it('should get active users', (done) => {
		Categories.create({
			name: 'test',
		}, (err, category) => {
			assert.ifError(err);
			Topics.post({
				uid: posterUid,
				cid: category.cid,
				title: 'Test Topic Title',
				content: 'The content of test topic',
			}, (err) => {
				assert.ifError(err);
				Categories.getActiveUsers(category.cid, (err, uids) => {
					assert.ifError(err);
					assert.equal(uids[0], posterUid);
					done();
				});
			});
		});
	});

	describe('tag whitelist', () => {
		let cid;
		const socketTopics = require('../src/socket.io/topics');
		before((done) => {
			Categories.create({
				name: 'test',
			}, (err, category) => {
				assert.ifError(err);
				cid = category.cid;
				done();
			});
		});

		it('should error if data is invalid', (done) => {
			socketTopics.isTagAllowed({ uid: posterUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should return true if category whitelist is empty', (done) => {
			socketTopics.isTagAllowed({ uid: posterUid }, { tag: 'notallowed', cid: cid }, (err, allowed) => {
				assert.ifError(err);
				assert(allowed);
				done();
			});
		});

		it('should add tags to category whitelist', (done) => {
			const data = {};
			data[cid] = {
				tagWhitelist: 'nodebb,jquery,javascript',
			};
			Categories.update(data, (err) => {
				assert.ifError(err);
				db.getSortedSetRange(`cid:${cid}:tag:whitelist`, 0, -1, (err, tagWhitelist) => {
					assert.ifError(err);
					assert.deepEqual(['nodebb', 'jquery', 'javascript'], tagWhitelist);
					done();
				});
			});
		});

		it('should return false if category whitelist does not have tag', (done) => {
			socketTopics.isTagAllowed({ uid: posterUid }, { tag: 'notallowed', cid: cid }, (err, allowed) => {
				assert.ifError(err);
				assert(!allowed);
				done();
			});
		});

		it('should return true if category whitelist has tag', (done) => {
			socketTopics.isTagAllowed({ uid: posterUid }, { tag: 'nodebb', cid: cid }, (err, allowed) => {
				assert.ifError(err);
				assert(allowed);
				done();
			});
		});

		it('should post a topic with only allowed tags', (done) => {
			Topics.post({
				uid: posterUid,
				cid: cid,
				title: 'Test Topic Title',
				content: 'The content of test topic',
				tags: ['nodebb', 'jquery', 'notallowed'],
			}, (err, data) => {
				assert.ifError(err);
				assert.equal(data.topicData.tags.length, 2);
				done();
			});
		});
	});


	describe('privileges', () => {
		const privileges = require('../src/privileges');

		it('should return empty array if uids is empty array', (done) => {
			privileges.categories.filterUids('find', categoryObj.cid, [], (err, uids) => {
				assert.ifError(err);
				assert.equal(uids.length, 0);
				done();
			});
		});

		it('should filter uids by privilege', (done) => {
			privileges.categories.filterUids('find', categoryObj.cid, [1, 2, 3, 4], (err, uids) => {
				assert.ifError(err);
				assert.deepEqual(uids, [1, 2]);
				done();
			});
		});

		it('should load category user privileges', (done) => {
			privileges.categories.userPrivileges(categoryObj.cid, 1, (err, data) => {
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

		it('should load global user privileges', (done) => {
			privileges.global.userPrivileges(1, (err, data) => {
				assert.ifError(err);
				assert.deepEqual(data, {
					ban: false,
					invite: false,
					chat: false,
					'search:content': false,
					'search:users': false,
					'search:tags': false,
					'view:users:info': false,
					'upload:post:image': false,
					'upload:post:file': false,
					signature: false,
					'local:login': false,
					'group:create': false,
					'view:users': false,
					'view:tags': false,
					'view:groups': false,
				});

				done();
			});
		});

		it('should load category group privileges', (done) => {
			privileges.categories.groupPrivileges(categoryObj.cid, 'registered-users', (err, data) => {
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

		it('should load global group privileges', (done) => {
			privileges.global.groupPrivileges('registered-users', (err, data) => {
				assert.ifError(err);
				assert.deepEqual(data, {
					'groups:ban': false,
					'groups:invite': false,
					'groups:chat': true,
					'groups:search:content': true,
					'groups:search:users': true,
					'groups:search:tags': true,
					'groups:view:users': true,
					'groups:view:users:info': false,
					'groups:view:tags': true,
					'groups:view:groups': true,
					'groups:upload:post:image': true,
					'groups:upload:post:file': false,
					'groups:signature': true,
					'groups:local:login': true,
					'groups:group:create': false,
				});

				done();
			});
		});

		it('should return false if cid is falsy', (done) => {
			privileges.categories.isUserAllowedTo('find', null, adminUid, (err, isAllowed) => {
				assert.ifError(err);
				assert.equal(isAllowed, false);
				done();
			});
		});

		describe('Categories.getModeratorUids', () => {
			before((done) => {
				async.series([
					async.apply(groups.create, { name: 'testGroup' }),
					async.apply(groups.join, 'cid:1:privileges:groups:moderate', 'testGroup'),
					async.apply(groups.join, 'testGroup', 1),
				], done);
			});

			it('should retrieve all users with moderator bit in category privilege', (done) => {
				Categories.getModeratorUids([1, 2], (err, uids) => {
					assert.ifError(err);
					assert.strictEqual(uids.length, 2);
					assert(uids[0].includes('1'));
					assert.strictEqual(uids[1].length, 0);
					done();
				});
			});

			it('should not fail when there are multiple groups', (done) => {
				async.series([
					async.apply(groups.create, { name: 'testGroup2' }),
					async.apply(groups.join, 'cid:1:privileges:groups:moderate', 'testGroup2'),
					async.apply(groups.join, 'testGroup2', 1),
					function (next) {
						Categories.getModeratorUids([1, 2], (err, uids) => {
							assert.ifError(err);
							assert(uids[0].includes('1'));
							next();
						});
					},
				], done);
			});

			after((done) => {
				async.series([
					async.apply(groups.leave, 'cid:1:privileges:groups:moderate', 'testGroup'),
					async.apply(groups.leave, 'cid:1:privileges:groups:moderate', 'testGroup2'),
					async.apply(groups.destroy, 'testGroup'),
					async.apply(groups.destroy, 'testGroup2'),
				], done);
			});
		});
	});


	describe('getTopicIds', () => {
		const plugins = require('../src/plugins');
		it('should get topic ids with filter', (done) => {
			function method(data, callback) {
				data.tids = [1, 2, 3];
				callback(null, data);
			}

			plugins.hooks.register('my-test-plugin', {
				hook: 'filter:categories.getTopicIds',
				method: method,
			});

			Categories.getTopicIds({
				cid: categoryObj.cid,
				start: 0,
				stop: 19,
			}, (err, tids) => {
				assert.ifError(err);
				assert.deepEqual(tids, [1, 2, 3]);
				plugins.hooks.unregister('my-test-plugin', 'filter:categories.getTopicIds', method);
				done();
			});
		});
	});

	it('should return nested children categories', async () => {
		const rootCategory = await Categories.create({ name: 'root' });
		const child1 = await Categories.create({ name: 'child1', parentCid: rootCategory.cid });
		const child2 = await Categories.create({ name: 'child2', parentCid: child1.cid });
		const data = await Categories.getCategoryById({
			uid: 1,
			cid: rootCategory.cid,
			start: 0,
			stop: 19,
		});
		assert.strictEqual(child1.cid, data.children[0].cid);
		assert.strictEqual(child2.cid, data.children[0].children[0].cid);
	});
});

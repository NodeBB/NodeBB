'use strict';

const assert = require('assert');
const nconf = require('nconf');

const request = require('../src/request');
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

	before(async () => {
		posterUid = await User.create({ username: 'poster' });
		adminUid = await User.create({ username: 'admin' });
		await groups.join('administrators', adminUid);
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
		Categories.getAllCategories((err, data) => {
			assert.ifError(err);
			assert(Array.isArray(data));
			assert.equal(data[0].cid, categoryObj.cid);
			done();
		});
	});

	it('should load a category route', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/category/${categoryObj.cid}/test-category`);
		assert.equal(response.statusCode, 200);
		assert.equal(body.name, 'Test Category &amp; NodeBB');
		assert(body);
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
		before(async () => {
			const [category, topic] = await Promise.all([
				Categories.create({
					name: 'Test Category 2',
					description: 'Test category created by testing script',
				}),
				Topics.post({
					uid: posterUid,
					cid: categoryObj.cid,
					title: 'Test Topic Title',
					content: 'The content of test topic',
				}),
			]);
			moveCid = category.cid;
			moveTid = topic.topicData.tid;
			await Topics.reply({ uid: posterUid, content: 'test post', tid: moveTid });
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

	describe('api/socket methods', () => {
		const socketCategories = require('../src/socket.io/categories');
		const apiCategories = require('../src/api/categories');
		before(async () => {
			await Topics.post({
				uid: posterUid,
				cid: categoryObj.cid,
				title: 'Test Topic Title',
				content: 'The content of test topic',
				tags: ['nodebb'],
			});
			const data = await Topics.post({
				uid: posterUid,
				cid: categoryObj.cid,
				title: 'will delete',
				content: 'The content of deleted topic',
			});
			await Topics.delete(data.topicData.tid, adminUid);
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

		it('should not show deleted topic titles', async () => {
			const data = await socketCategories.loadMore({ uid: 0 }, {
				cid: categoryObj.cid,
				after: 0,
			});

			assert.deepStrictEqual(
				data.topics.map(t => t.title),
				['[[topic:topic-is-deleted]]', 'Test Topic Title', 'Test Topic Title'],
			);
		});

		it('should load topic count', (done) => {
			socketCategories.getTopicCount({ uid: posterUid }, categoryObj.cid, (err, topicCount) => {
				assert.ifError(err);
				assert.strictEqual(topicCount, 3);
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

		it('should get category data', async () => {
			const data = await apiCategories.get({ uid: posterUid }, { cid: categoryObj.cid });
			assert.equal(categoryObj.cid, data.cid);
		});
	});

	describe('admin api/socket methods', () => {
		const socketCategories = require('../src/socket.io/admin/categories');
		const apiCategories = require('../src/api/categories');
		let cid;
		before(async () => {
			const category = await apiCategories.create({ uid: adminUid }, {
				name: 'update name',
				description: 'update description',
				parentCid: categoryObj.cid,
				icon: 'fa-check',
				order: '5',
			});
			cid = category.cid;
		});

		it('should return error with invalid data', async () => {
			let err;
			try {
				await apiCategories.update({ uid: adminUid }, null);
			} catch (_err) {
				err = _err;
			}
			assert.strictEqual(err.message, '[[error:invalid-data]]');
		});

		it('should error if you try to set parent as self', async () => {
			const updateData = {
				cid,
				values: {
					parentCid: cid,
				},
			};
			let err;
			try {
				await apiCategories.update({ uid: adminUid }, updateData);
			} catch (_err) {
				err = _err;
			}
			assert.strictEqual(err.message, '[[error:cant-set-self-as-parent]]');
		});

		it('should error if you try to set child as parent', async () => {
			const parentCategory = await Categories.create({ name: 'parent 1', description: 'poor parent' });
			const parentCid = parentCategory.cid;
			const childCategory = await Categories.create({ name: 'child1', description: 'wanna be parent', parentCid: parentCid });
			const child1Cid = childCategory.cid;
			const updateData = {
				cid: parentCid,
				values: {
					parentCid: child1Cid,
				},
			};
			let err;
			try {
				await apiCategories.update({ uid: adminUid }, updateData);
			} catch (_err) {
				err = _err;
			}
			assert.strictEqual(err.message, '[[error:cant-set-child-as-parent]]');
		});

		it('should update category data', async () => {
			const updateData = {
				cid,
				values: {
					name: 'new name',
					description: 'new description',
					parentCid: 0,
					order: 3,
					icon: 'fa-hammer',
				},
			};
			await apiCategories.update({ uid: adminUid }, updateData);

			const data = await Categories.getCategoryData(cid);
			assert.equal(data.name, updateData.values.name);
			assert.equal(data.description, updateData.values.description);
			assert.equal(data.parentCid, updateData.values.parentCid);
			assert.equal(data.order, updateData.values.order);
			assert.equal(data.icon, updateData.values.icon);
		});

		it('should properly order categories', async () => {
			const p1 = await Categories.create({ name: 'p1', description: 'd', parentCid: 0, order: 1 });
			const c1 = await Categories.create({ name: 'c1', description: 'd1', parentCid: p1.cid, order: 1 });
			const c2 = await Categories.create({ name: 'c2', description: 'd2', parentCid: p1.cid, order: 2 });
			const c3 = await Categories.create({ name: 'c3', description: 'd3', parentCid: p1.cid, order: 3 });
			// move c1 to second place
			await apiCategories.update({ uid: adminUid }, { cid: c1.cid, values: { order: 2 } });
			let cids = await db.getSortedSetRange(`cid:${p1.cid}:children`, 0, -1);
			assert.deepStrictEqual(cids.map(Number), [c2.cid, c1.cid, c3.cid]);

			// move c3 to front
			await apiCategories.update({ uid: adminUid }, { cid: c3.cid, values: { order: 1 } });
			cids = await db.getSortedSetRange(`cid:${p1.cid}:children`, 0, -1);
			assert.deepStrictEqual(cids.map(Number), [c3.cid, c2.cid, c1.cid]);
		});

		it('should not remove category from parent if parent is set again to same category', async () => {
			const parentCat = await Categories.create({ name: 'parent', description: 'poor parent' });
			const updateData = {};
			updateData[cid] = {
				parentCid: parentCat.cid,
			};
			await Categories.update(updateData);
			let data = await Categories.getCategoryData(cid);
			assert.equal(data.parentCid, updateData[cid].parentCid);
			let childrenCids = await db.getSortedSetRange(`cid:${parentCat.cid}:children`, 0, -1);
			assert(childrenCids.includes(String(cid)));

			// update again to same parent
			await Categories.update(updateData);
			data = await Categories.getCategoryData(cid);
			assert.equal(data.parentCid, updateData[cid].parentCid);
			childrenCids = await db.getSortedSetRange(`cid:${parentCat.cid}:children`, 0, -1);
			assert(childrenCids.includes(String(cid)));
		});

		it('should purge category', async () => {
			const category = await Categories.create({
				name: 'purge me',
				description: 'update description',
			});
			await Topics.post({
				uid: posterUid,
				cid: category.cid,
				title: 'Test Topic Title',
				content: 'The content of test topic',
			});
			await apiCategories.delete({ uid: adminUid }, { cid: category.cid });
			const data = await Categories.getCategoryById(category.cid);
			assert.strictEqual(data, null);
		});

		it('should get all category names', (done) => {
			socketCategories.getNames({ uid: adminUid }, {}, (err, data) => {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should give privilege', async () => {
			await apiCategories.setPrivilege({ uid: adminUid }, { cid: categoryObj.cid, privilege: ['groups:topics:delete'], set: true, member: 'registered-users' });
			const canDeleteTopics = await privileges.categories.can('topics:delete', categoryObj.cid, posterUid);
			assert(canDeleteTopics);
		});

		it('should remove privilege', async () => {
			await apiCategories.setPrivilege({ uid: adminUid }, { cid: categoryObj.cid, privilege: 'groups:topics:delete', set: false, member: 'registered-users' });
			const canDeleteTopics = await privileges.categories.can('topics:delete', categoryObj.cid, posterUid);
			assert(!canDeleteTopics);
		});

		it('should get privilege settings', async () => {
			const data = await apiCategories.getPrivileges({ uid: adminUid }, categoryObj.cid);
			assert(data.labelData);
			assert(data.keys.users);
			assert(data.keys.groups);
			assert(data.users);
			assert(data.groups);
		});

		it('should copy privileges to children', async () => {
			const parentCategory = await Categories.create({ name: 'parent' });
			const parentCid = parentCategory.cid;
			const child1 = await Categories.create({ name: 'child1', parentCid: parentCid });
			const child2 = await Categories.create({ name: 'child2', parentCid: child1.cid });
			await apiCategories.setPrivilege({ uid: adminUid }, {
				cid: parentCid,
				privilege: 'groups:topics:delete',
				set: true,
				member: 'registered-users',
			});
			await socketCategories.copyPrivilegesToChildren({ uid: adminUid }, { cid: parentCid, group: '' });
			const canDelete = await privileges.categories.can('topics:delete', child2.cid, posterUid);
			assert(canDelete);
		});

		it('should create category with settings from', async () => {
			const category = await Categories.create({ name: 'copy from', description: 'copy me' });
			const parentCid = category.cid;
			const childCategory = await Categories.create({ name: 'child1', description: 'will be gone', cloneFromCid: parentCid });
			assert.equal(childCategory.description, 'copy me');
		});

		it('should copy settings from', async () => {
			const category = await Categories.create({ name: 'parent', description: 'copy me' });
			const parentCid = category.cid;
			const childCategory = await Categories.create({ name: 'child1' });
			const child1Cid = childCategory.cid;
			const destinationCategory = await socketCategories.copySettingsFrom(
				{ uid: adminUid },
				{ fromCid: parentCid, toCid: child1Cid, copyParent: true },
			);
			const description = await Categories.getCategoryField(child1Cid, 'description');
			assert.equal(description, 'copy me');
		});

		it('should copy privileges from another category', async () => {
			const parent = await Categories.create({ name: 'parent', description: 'copy me' });
			const parentCid = parent.cid;
			const child1 = await Categories.create({ name: 'child1' });
			await apiCategories.setPrivilege({ uid: adminUid }, {
				cid: parentCid,
				privilege: 'groups:topics:delete',
				set: true,
				member: 'registered-users',
			});
			await socketCategories.copyPrivilegesFrom({ uid: adminUid }, { fromCid: parentCid, toCid: child1.cid });
			const canDelete = await privileges.categories.can('topics:delete', child1.cid, posterUid);
			assert(canDelete);
		});

		it('should copy privileges from another category for a single group', async () => {
			const parent = await Categories.create({ name: 'parent', description: 'copy me' });
			const parentCid = parent.cid;
			const child1 = await Categories.create({ name: 'child1' });
			await apiCategories.setPrivilege({ uid: adminUid }, {
				cid: parentCid,
				privilege: 'groups:topics:delete',
				set: true,
				member: 'registered-users',
			});
			await socketCategories.copyPrivilegesFrom({ uid: adminUid }, { fromCid: parentCid, toCid: child1.cid, group: 'registered-users' });
			const canDelete = await privileges.categories.can('topics:delete', child1.cid, 0);
			assert(!canDelete);
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
					'topics:schedule': false,
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
					mute: false,
					invite: false,
					chat: false,
					'chat:privileged': false,
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
					'groups:topics:schedule': false,
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
					'groups:mute': false,
					'groups:invite': false,
					'groups:chat': true,
					'groups:chat:privileged': false,
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
			let cid;

			before(async () => {
				({ cid } = await Categories.create({ name: 'foobar' }));
				await groups.create({ name: 'testGroup' });
				await groups.join(`cid:${cid}:privileges:groups:moderate`, 'testGroup');
				await groups.join('testGroup', 1);
			});

			it('should retrieve all users with moderator bit in category privilege', (done) => {
				Categories.getModeratorUids([cid, 2], (err, uids) => {
					assert.ifError(err);
					assert.strictEqual(uids.length, 2);
					assert(uids[0].includes('1'));
					assert.strictEqual(uids[1].length, 0);
					done();
				});
			});

			it('should not fail when there are multiple groups', async () => {
				await groups.create({ name: 'testGroup2' });
				await groups.join('cid:1:privileges:groups:moderate', 'testGroup2');
				await groups.join('testGroup2', 1);
				const uids = await Categories.getModeratorUids([cid, 2]);
				assert(uids[0].includes('1'));
			});

			it('should not return moderators of disabled categories', async () => {
				const payload = {};
				payload[cid] = { disabled: 1 };
				await Categories.update(payload);
				const uids = await Categories.getModeratorUids([cid, 2]);
				assert(!uids[0].includes('1'));
			});

			after(async () => {
				await groups.leave(`cid:${cid}:privileges:groups:moderate`, 'testGroup');
				await groups.leave(`cid:${cid}:privileges:groups:moderate`, 'testGroup2');
				await groups.destroy('testGroup');
				await groups.destroy('testGroup2');
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

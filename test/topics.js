'use strict';

const path = require('path');
const assert = require('assert');
const validator = require('validator');
const mockdate = require('mockdate');
const nconf = require('nconf');
const util = require('util');

const sleep = util.promisify(setTimeout);

const db = require('./mocks/databasemock');
const file = require('../src/file');
const topics = require('../src/topics');
const posts = require('../src/posts');
const categories = require('../src/categories');
const privileges = require('../src/privileges');
const meta = require('../src/meta');
const User = require('../src/user');
const groups = require('../src/groups');
const utils = require('../src/utils');
const helpers = require('./helpers');
const socketTopics = require('../src/socket.io/topics');
const apiTopics = require('../src/api/topics');
const apiPosts = require('../src/api/posts');
const request = require('../src/request');

describe('Topic\'s', () => {
	let topic;
	let categoryObj;
	let adminUid;
	let adminJar;
	let csrf_token;
	let fooUid;

	before(async () => {
		adminUid = await User.create({ username: 'admin', password: '123456' });
		fooUid = await User.create({ username: 'foo' });
		await groups.join('administrators', adminUid);
		const adminLogin = await helpers.loginUser('admin', '123456');
		adminJar = adminLogin.jar;
		csrf_token = adminLogin.csrf_token;

		categoryObj = await categories.create({
			name: 'Test Category',
			description: 'Test category created by testing script',
		});
		topic = {
			userId: adminUid,
			categoryId: categoryObj.cid,
			title: 'Test Topic Title',
			content: 'The content of test topic',
		};
	});

	describe('.post', () => {
		it('should fail to create topic with invalid data', async () => {
			try {
				await apiTopics.create({ uid: 0 }, null);
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
			}
		});

		it('should create a new topic with proper parameters', (done) => {
			topics.post({
				uid: topic.userId,
				title: topic.title,
				content: topic.content,
				cid: topic.categoryId,
			}, (err, result) => {
				assert.ifError(err);
				assert(result);
				topic.tid = result.topicData.tid;
				done();
			});
		});

		it('should get post count', async () => {
			const count = await socketTopics.postcount({ uid: adminUid }, topic.tid);
			assert.strictEqual(count, 1);
		});

		it('should get users postcount in topic', async () => {
			assert.strictEqual(await socketTopics.getPostCountInTopic({ uid: 0 }, 0), 0);
			assert.strictEqual(await socketTopics.getPostCountInTopic({ uid: adminUid }, 0), 0);
			assert.strictEqual(await socketTopics.getPostCountInTopic({ uid: adminUid }, topic.tid), 1);
		});

		it('should load topic', async () => {
			const data = await apiTopics.get({ uid: adminUid }, { tid: topic.tid });
			assert.equal(data.tid, topic.tid);
		});

		it('should fail to create new topic with invalid user id', (done) => {
			topics.post({ uid: null, title: topic.title, content: topic.content, cid: topic.categoryId }, (err) => {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail to create new topic with empty title', (done) => {
			topics.post({ uid: fooUid, title: '', content: topic.content, cid: topic.categoryId }, (err) => {
				assert.ok(err);
				done();
			});
		});

		it('should fail to create new topic with empty content', (done) => {
			topics.post({ uid: fooUid, title: topic.title, content: '', cid: topic.categoryId }, (err) => {
				assert.ok(err);
				done();
			});
		});

		it('should fail to create new topic with non-existant category id', (done) => {
			topics.post({ uid: topic.userId, title: topic.title, content: topic.content, cid: 99 }, (err) => {
				assert.equal(err.message, '[[error:no-category]]', 'received no error');
				done();
			});
		});

		it('should return false for falsy uid', (done) => {
			topics.isOwner(topic.tid, 0, (err, isOwner) => {
				assert.ifError(err);
				assert(!isOwner);
				done();
			});
		});

		it('should fail to post a topic as guest with invalid csrf_token', async () => {
			const categoryObj = await categories.create({
				name: 'Test Category',
				description: 'Test category created by testing script',
			});
			await privileges.categories.give(['groups:topics:create'], categoryObj.cid, 'guests');
			await privileges.categories.give(['groups:topics:reply'], categoryObj.cid, 'guests');
			const result = await request.post(`${nconf.get('url')}/api/v3/topics`, {
				data: {
					title: 'just a title',
					cid: categoryObj.cid,
					content: 'content for the main post',
				},
				headers: {
					'x-csrf-token': 'invalid',
				},
			});
			assert.strictEqual(result.response.statusCode, 403);
			assert.strictEqual(result.body, 'Forbidden');
		});

		it('should fail to post a topic as guest if no privileges', async () => {
			const categoryObj = await categories.create({
				name: 'Test Category',
				description: 'Test category created by testing script',
			});
			const jar = request.jar();
			const result = await helpers.request('post', `/api/v3/topics`, {
				body: {
					title: 'just a title',
					cid: categoryObj.cid,
					content: 'content for the main post',
				},
				jar: jar,
			});
			assert.strictEqual(result.body.status.message, 'You do not have enough privileges for this action.');
		});

		it('should post a topic as guest if guest group has privileges', async () => {
			const categoryObj = await categories.create({
				name: 'Test Category',
				description: 'Test category created by testing script',
			});
			await privileges.categories.give(['groups:topics:create'], categoryObj.cid, 'guests');
			await privileges.categories.give(['groups:topics:reply'], categoryObj.cid, 'guests');

			const jar = request.jar();
			const result = await helpers.request('post', `/api/v3/topics`, {
				body: {
					title: 'just a title',
					cid: categoryObj.cid,
					content: 'content for the main post',
				},
				jar: jar,
				json: true,
			});

			assert.strictEqual(result.body.status.code, 'ok');
			assert.strictEqual(result.body.response.title, 'just a title');
			assert.strictEqual(result.body.response.user.username, '[[global:guest]]');

			const replyResult = await helpers.request('post', `/api/v3/topics/${result.body.response.tid}`, {
				body: {
					content: 'a reply by guest',
				},
				jar: jar,
			});
			assert.strictEqual(replyResult.body.response.content, 'a reply by guest');
			assert.strictEqual(replyResult.body.response.user.username, '[[global:guest]]');
		});

		it('should post a topic/reply as guest with handle if guest group has privileges', async () => {
			const categoryObj = await categories.create({
				name: 'Test Category',
				description: 'Test category created by testing script',
			});
			await privileges.categories.give(['groups:topics:create'], categoryObj.cid, 'guests');
			await privileges.categories.give(['groups:topics:reply'], categoryObj.cid, 'guests');
			const oldValue = meta.config.allowGuestHandles;
			meta.config.allowGuestHandles = 1;
			const result = await helpers.request('post', `/api/v3/topics`, {
				body: {
					title: 'just a title',
					cid: categoryObj.cid,
					content: 'content for the main post',
					handle: 'guest123',
				},
				jar: request.jar(),
			});

			assert.strictEqual(result.body.status.code, 'ok');
			assert.strictEqual(result.body.response.title, 'just a title');
			assert.strictEqual(result.body.response.user.username, 'guest123');
			assert.strictEqual(result.body.response.user.displayname, 'guest123');

			const replyResult = await helpers.request('post', `/api/v3/topics/${result.body.response.tid}`, {
				body: {
					content: 'a reply by guest',
					handle: 'guest124',
				},
				jar: request.jar(),
			});
			assert.strictEqual(replyResult.body.response.content, 'a reply by guest');
			assert.strictEqual(replyResult.body.response.user.username, 'guest124');
			assert.strictEqual(replyResult.body.response.user.displayname, 'guest124');
			meta.config.allowGuestHandles = oldValue;
		});
	});

	describe('.reply', () => {
		let newTopic;
		let newPost;

		before((done) => {
			topics.post({
				uid: topic.userId,
				title: topic.title,
				content: topic.content,
				cid: topic.categoryId,
			}, (err, result) => {
				if (err) {
					return done(err);
				}

				newTopic = result.topicData;
				newPost = result.postData;
				done();
			});
		});

		it('should create a new reply with proper parameters', (done) => {
			topics.reply({ uid: topic.userId, content: 'test post', tid: newTopic.tid }, (err, result) => {
				assert.equal(err, null, 'was created with error');
				assert.ok(result);

				done();
			});
		});

		it('should handle direct replies', async () => {
			const result = await topics.reply({ uid: topic.userId, content: 'test reply', tid: newTopic.tid, toPid: newPost.pid });
			assert.ok(result);

			const postData = await apiPosts.getReplies({ uid: 0 }, { pid: newPost.pid });
			assert.ok(postData);

			assert.equal(postData.length, 1, 'should have 1 result');
			assert.equal(postData[0].pid, result.pid, 'result should be the reply we added');
		});

		it('should error if pid is not a number', async () => {
			await assert.rejects(
				apiPosts.getReplies({ uid: 0 }, { pid: 'abc' }),
				{ message: '[[error:invalid-data]]' }
			);
		});

		it('should fail to create new reply with invalid user id', (done) => {
			topics.reply({ uid: null, content: 'test post', tid: newTopic.tid }, (err) => {
				assert.strictEqual(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail to create new reply with empty content', (done) => {
			topics.reply({ uid: fooUid, content: '', tid: newTopic.tid }, (err) => {
				assert.strictEqual(err.message, '[[error:content-too-short, 8]]');
				done();
			});
		});

		it('should fail to create new reply with invalid topic id', (done) => {
			topics.reply({ uid: null, content: 'test post', tid: 99 }, (err) => {
				assert.strictEqual(err.message, '[[error:no-topic]]');
				done();
			});
		});

		it('should fail to create new reply with invalid toPid', (done) => {
			topics.reply({ uid: topic.userId, content: 'test post', tid: newTopic.tid, toPid: '"onmouseover=alert(1);//' }, (err) => {
				assert.strictEqual(err.message, '[[error:invalid-pid]]');
				done();
			});
		});

		it('should fail to create new reply with toPid that has been purged', async () => {
			const { postData } = await topics.post({
				uid: topic.userId,
				cid: topic.categoryId,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			});
			await posts.purge(postData.pid, topic.userId);

			await assert.rejects(
				topics.reply({ uid: topic.userId, content: 'test post', tid: postData.topic.tid, toPid: postData.pid }),
				{ message: '[[error:invalid-pid]]' }
			);
		});

		it('should fail to create a new reply with toPid that has been deleted (user cannot view_deleted)', async () => {
			const { postData } = await topics.post({
				uid: topic.userId,
				cid: topic.categoryId,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			});
			await posts.delete(postData.pid, topic.userId);
			const uid = await User.create({ username: utils.generateUUID().slice(0, 10) });

			await assert.rejects(
				topics.reply({ uid, content: 'test post', tid: postData.topic.tid, toPid: postData.pid }),
				{ message: '[[error:invalid-pid]]' }
			);
		});

		it('should properly create a new reply with toPid that has been deleted (user\'s own deleted post)', async () => {
			const { postData } = await topics.post({
				uid: topic.userId,
				cid: topic.categoryId,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			});
			await posts.delete(postData.pid, topic.userId);
			const uid = await User.create({ username: utils.generateUUID().slice(0, 10) });

			const { pid } = await topics.reply({ uid: topic.userId, content: 'test post', tid: postData.topic.tid, toPid: postData.pid });
			assert(pid);
		});

		it('should delete nested relies properly', async () => {
			const result = await topics.post({ uid: fooUid, title: 'nested test', content: 'main post', cid: topic.categoryId });
			const reply1 = await topics.reply({ uid: fooUid, content: 'reply post 1', tid: result.topicData.tid });
			const reply2 = await topics.reply({ uid: fooUid, content: 'reply post 2', tid: result.topicData.tid, toPid: reply1.pid });
			let replies = await apiPosts.getReplies({ uid: fooUid }, { pid: reply1.pid });
			assert.strictEqual(replies.length, 1);
			assert.strictEqual(replies[0].content, 'reply post 2');
			let toPid = await posts.getPostField(reply2.pid, 'toPid');
			assert.strictEqual(parseInt(toPid, 10), parseInt(reply1.pid, 10));
			await posts.purge(reply1.pid, fooUid);
			replies = await apiPosts.getReplies({ uid: fooUid }, { pid: reply1.pid });
			assert.strictEqual(replies, null);
			toPid = await posts.getPostField(reply2.pid, 'toPid');
			assert.strictEqual(toPid, null);
		});
	});

	describe('Get methods', () => {
		let newTopic;
		let newPost;

		before((done) => {
			topics.post({
				uid: topic.userId,
				title: topic.title,
				content: topic.content,
				cid: topic.categoryId,
			}, (err, result) => {
				if (err) {
					return done(err);
				}

				newTopic = result.topicData;
				newPost = result.postData;
				done();
			});
		});


		it('should not receive errors', (done) => {
			topics.getTopicData(newTopic.tid, (err, topicData) => {
				assert.ifError(err);
				assert(typeof topicData.tid === 'number');
				assert(typeof topicData.uid === 'number');
				assert(typeof topicData.cid === 'number');
				assert(typeof topicData.mainPid === 'number');

				assert(typeof topicData.timestamp === 'number');
				assert.strictEqual(topicData.postcount, 1);
				assert.strictEqual(topicData.viewcount, 0);
				assert.strictEqual(topicData.upvotes, 0);
				assert.strictEqual(topicData.downvotes, 0);
				assert.strictEqual(topicData.votes, 0);
				assert.strictEqual(topicData.deleted, 0);
				assert.strictEqual(topicData.locked, 0);
				assert.strictEqual(topicData.pinned, 0);
				done();
			});
		});

		it('should get a single field', (done) => {
			topics.getTopicFields(newTopic.tid, ['slug'], (err, data) => {
				assert.ifError(err);
				assert(Object.keys(data).length === 1);
				assert(data.hasOwnProperty('slug'));
				done();
			});
		});

		it('should get topic title by pid', (done) => {
			topics.getTitleByPid(newPost.pid, (err, title) => {
				assert.ifError(err);
				assert.equal(title, topic.title);
				done();
			});
		});

		it('should get topic data by pid', (done) => {
			topics.getTopicDataByPid(newPost.pid, (err, data) => {
				assert.ifError(err);
				assert.equal(data.tid, newTopic.tid);
				done();
			});
		});

		describe('.getTopicWithPosts', () => {
			let tid;
			before(async () => {
				const result = await topics.post({ uid: topic.userId, title: 'page test', content: 'main post', cid: topic.categoryId });
				tid = result.topicData.tid;
				for (let i = 0; i < 30; i++) {
					// eslint-disable-next-line no-await-in-loop
					await topics.reply({ uid: adminUid, content: `topic reply ${i + 1}`, tid: tid });
				}
			});

			it('should get a topic with posts and other data', async () => {
				const topicData = await topics.getTopicData(tid);
				const data = await topics.getTopicWithPosts(topicData, `tid:${tid}:posts`, topic.userId, 0, -1, false);
				assert(data);
				assert.equal(data.category.cid, topic.categoryId);
				assert.equal(data.unreplied, false);
				assert.equal(data.deleted, false);
				assert.equal(data.locked, false);
				assert.equal(data.pinned, false);
			});

			it('should return first 3 posts including main post', async () => {
				const topicData = await topics.getTopicData(tid);
				const data = await topics.getTopicWithPosts(topicData, `tid:${tid}:posts`, topic.userId, 0, 2, false);
				assert.strictEqual(data.posts.length, 3);
				assert.strictEqual(data.posts[0].content, 'main post');
				assert.strictEqual(data.posts[1].content, 'topic reply 1');
				assert.strictEqual(data.posts[2].content, 'topic reply 2');
				data.posts.forEach((post, index) => {
					assert.strictEqual(post.index, index);
				});
			});

			it('should return 3 posts from 1 to 3 excluding main post', async () => {
				const topicData = await topics.getTopicData(tid);
				const start = 1;
				const data = await topics.getTopicWithPosts(topicData, `tid:${tid}:posts`, topic.userId, start, 3, false);
				assert.strictEqual(data.posts.length, 3);
				assert.strictEqual(data.posts[0].content, 'topic reply 1');
				assert.strictEqual(data.posts[1].content, 'topic reply 2');
				assert.strictEqual(data.posts[2].content, 'topic reply 3');
				data.posts.forEach((post, index) => {
					assert.strictEqual(post.index, index + start);
				});
			});

			it('should return main post and last 2 posts', async () => {
				const topicData = await topics.getTopicData(tid);
				const data = await topics.getTopicWithPosts(topicData, `tid:${tid}:posts`, topic.userId, 0, 2, true);
				assert.strictEqual(data.posts.length, 3);
				assert.strictEqual(data.posts[0].content, 'main post');
				assert.strictEqual(data.posts[1].content, 'topic reply 30');
				assert.strictEqual(data.posts[2].content, 'topic reply 29');
				data.posts.forEach((post, index) => {
					assert.strictEqual(post.index, index);
				});
			});

			it('should return last 3 posts and not main post', async () => {
				const topicData = await topics.getTopicData(tid);
				const start = 1;
				const data = await topics.getTopicWithPosts(topicData, `tid:${tid}:posts`, topic.userId, start, 3, true);
				assert.strictEqual(data.posts.length, 3);
				assert.strictEqual(data.posts[0].content, 'topic reply 30');
				assert.strictEqual(data.posts[1].content, 'topic reply 29');
				assert.strictEqual(data.posts[2].content, 'topic reply 28');
				data.posts.forEach((post, index) => {
					assert.strictEqual(post.index, index + start);
				});
			});

			it('should return posts 29 to 27 posts and not main post', async () => {
				const topicData = await topics.getTopicData(tid);
				const start = 2;
				const data = await topics.getTopicWithPosts(topicData, `tid:${tid}:posts`, topic.userId, start, 4, true);
				assert.strictEqual(data.posts.length, 3);
				assert.strictEqual(data.posts[0].content, 'topic reply 29');
				assert.strictEqual(data.posts[1].content, 'topic reply 28');
				assert.strictEqual(data.posts[2].content, 'topic reply 27');
				data.posts.forEach((post, index) => {
					assert.strictEqual(post.index, index + start);
				});
			});

			it('should return 3 posts in reverse', async () => {
				const topicData = await topics.getTopicData(tid);
				const start = 28;
				const data = await topics.getTopicWithPosts(topicData, `tid:${tid}:posts`, topic.userId, start, 30, true);
				assert.strictEqual(data.posts.length, 3);
				assert.strictEqual(data.posts[0].content, 'topic reply 3');
				assert.strictEqual(data.posts[1].content, 'topic reply 2');
				assert.strictEqual(data.posts[2].content, 'topic reply 1');
				data.posts.forEach((post, index) => {
					assert.strictEqual(post.index, index + start);
				});
			});

			it('should get all posts with main post at the start', async () => {
				const topicData = await topics.getTopicData(tid);
				const data = await topics.getTopicWithPosts(topicData, `tid:${tid}:posts`, topic.userId, 0, -1, false);
				assert.strictEqual(data.posts.length, 31);
				assert.strictEqual(data.posts[0].content, 'main post');
				assert.strictEqual(data.posts[1].content, 'topic reply 1');
				assert.strictEqual(data.posts[data.posts.length - 1].content, 'topic reply 30');
				data.posts.forEach((post, index) => {
					assert.strictEqual(post.index, index);
				});
			});

			it('should get all posts in reverse with main post at the start followed by reply 30', async () => {
				const topicData = await topics.getTopicData(tid);
				const data = await topics.getTopicWithPosts(topicData, `tid:${tid}:posts`, topic.userId, 0, -1, true);
				assert.strictEqual(data.posts.length, 31);
				assert.strictEqual(data.posts[0].content, 'main post');
				assert.strictEqual(data.posts[1].content, 'topic reply 30');
				assert.strictEqual(data.posts[data.posts.length - 1].content, 'topic reply 1');
				data.posts.forEach((post, index) => {
					assert.strictEqual(post.index, index);
				});
			});

			it('should return empty array if first param is falsy', async () => {
				const posts = await topics.getTopicPosts(null, `tid:${tid}:posts`, 0, 9, topic.userId, true);
				assert.deepStrictEqual(posts, []);
			});

			it('should only return main post', async () => {
				const topicData = await topics.getTopicData(tid);
				const postsData = await topics.getTopicPosts(topicData, `tid:${tid}:posts`, 0, 0, topic.userId, false);
				assert.strictEqual(postsData.length, 1);
				assert.strictEqual(postsData[0].content, 'main post');
			});

			it('should only return first reply', async () => {
				const topicData = await topics.getTopicData(tid);
				const postsData = await topics.getTopicPosts(topicData, `tid:${tid}:posts`, 1, 1, topic.userId, false);
				assert.strictEqual(postsData.length, 1);
				assert.strictEqual(postsData[0].content, 'topic reply 1');
			});

			it('should return main post and first reply', async () => {
				const topicData = await topics.getTopicData(tid);
				const postsData = await topics.getTopicPosts(topicData, `tid:${tid}:posts`, 0, 1, topic.userId, false);
				assert.strictEqual(postsData.length, 2);
				assert.strictEqual(postsData[0].content, 'main post');
				assert.strictEqual(postsData[1].content, 'topic reply 1');
			});

			it('should return posts in correct order', async () => {
				const data = await socketTopics.loadMore({ uid: topic.userId }, { tid: tid, after: 20, direction: 1 });
				assert.strictEqual(data.posts.length, 11);
				assert.strictEqual(data.posts[0].content, 'topic reply 20');
				assert.strictEqual(data.posts[1].content, 'topic reply 21');
			});

			it('should return posts in correct order in reverse direction', async () => {
				const data = await socketTopics.loadMore({ uid: topic.userId }, { tid: tid, after: 25, direction: -1 });
				assert.strictEqual(data.posts.length, 20);
				assert.strictEqual(data.posts[0].content, 'topic reply 5');
				assert.strictEqual(data.posts[1].content, 'topic reply 6');
			});

			it('should return all posts in correct order', async () => {
				const topicData = await topics.getTopicData(tid);
				const postsData = await topics.getTopicPosts(topicData, `tid:${tid}:posts`, 0, -1, topic.userId, false);
				assert.strictEqual(postsData.length, 31);
				assert.strictEqual(postsData[0].content, 'main post');
				for (let i = 1; i < 30; i++) {
					assert.strictEqual(postsData[i].content, `topic reply ${i}`);
				}
			});
		});
	});

	describe('Title escaping', () => {
		it('should properly escape topic title', (done) => {
			const title = '"<script>alert(\'ok1\');</script> new topic test';
			const titleEscaped = validator.escape(title);
			topics.post({ uid: topic.userId, title: title, content: topic.content, cid: topic.categoryId }, (err, result) => {
				assert.ifError(err);
				topics.getTopicData(result.topicData.tid, (err, topicData) => {
					assert.ifError(err);
					assert.strictEqual(topicData.titleRaw, title);
					assert.strictEqual(topicData.title, titleEscaped);
					done();
				});
			});
		});
	});

	describe('tools/delete/restore/purge', () => {
		let newTopic;
		let followerUid;
		let moveCid;

		before(async () => {
			({ topicData: newTopic } = await topics.post({
				uid: topic.userId,
				title: topic.title,
				content: topic.content,
				cid: topic.categoryId,
			}));
			followerUid = await User.create({ username: 'topicFollower', password: '123456' });
			await topics.follow(newTopic.tid, followerUid);

			({ cid: moveCid } = await categories.create({
				name: 'Test Category',
				description: 'Test category created by testing script',
			}));
		});

		it('should load topic tools', (done) => {
			socketTopics.loadTopicTools({ uid: adminUid }, { tid: newTopic.tid }, (err, data) => {
				assert.ifError(err);
				assert(data);
				done();
			});
		});

		it('should delete the topic', async () => {
			await apiTopics.delete({ uid: adminUid }, { tids: [newTopic.tid], cid: categoryObj.cid });
			const deleted = await topics.getTopicField(newTopic.tid, 'deleted');
			assert.strictEqual(deleted, 1);
		});

		it('should restore the topic', async () => {
			await apiTopics.restore({ uid: adminUid }, { tids: [newTopic.tid], cid: categoryObj.cid });
			const deleted = await topics.getTopicField(newTopic.tid, 'deleted');
			assert.strictEqual(deleted, 0);
		});

		it('should lock topic', async () => {
			await apiTopics.lock({ uid: adminUid }, { tids: [newTopic.tid], cid: categoryObj.cid });
			const isLocked = await topics.isLocked(newTopic.tid);
			assert(isLocked);
		});

		it('should unlock topic', async () => {
			await apiTopics.unlock({ uid: adminUid }, { tids: [newTopic.tid], cid: categoryObj.cid });
			const isLocked = await topics.isLocked(newTopic.tid);
			assert(!isLocked);
		});

		it('should pin topic', async () => {
			await apiTopics.pin({ uid: adminUid }, { tids: [newTopic.tid], cid: categoryObj.cid });
			const pinned = await topics.getTopicField(newTopic.tid, 'pinned');
			assert.strictEqual(pinned, 1);
		});

		it('should unpin topic', async () => {
			await apiTopics.unpin({ uid: adminUid }, { tids: [newTopic.tid], cid: categoryObj.cid });
			const pinned = await topics.getTopicField(newTopic.tid, 'pinned');
			assert.strictEqual(pinned, 0);
		});

		it('should move all topics', (done) => {
			socketTopics.moveAll({ uid: adminUid }, { cid: moveCid, currentCid: categoryObj.cid }, (err) => {
				assert.ifError(err);
				topics.getTopicField(newTopic.tid, 'cid', (err, cid) => {
					assert.ifError(err);
					assert.equal(cid, moveCid);
					done();
				});
			});
		});

		it('should move a topic', (done) => {
			socketTopics.move({ uid: adminUid }, { cid: categoryObj.cid, tids: [newTopic.tid] }, (err) => {
				assert.ifError(err);
				topics.getTopicField(newTopic.tid, 'cid', (err, cid) => {
					assert.ifError(err);
					assert.equal(cid, categoryObj.cid);
					done();
				});
			});
		});

		it('should properly update sets when post is moved', async () => {
			const cid1 = topic.categoryId;
			const category = await categories.create({
				name: 'move to this category',
				description: 'Test category created by testing script',
			});
			const cid2 = category.cid;
			const { topicData } = await topics.post({ uid: adminUid, title: 'topic1', content: 'topic 1 mainPost', cid: cid1 });
			const tid1 = topicData.tid;
			const previousPost = await topics.reply({ uid: adminUid, content: 'topic 1 reply 1', tid: tid1 });
			const movedPost = await topics.reply({ uid: adminUid, content: 'topic 1 reply 2', tid: tid1 });

			const { topicData: anotherTopic } = await topics.post({ uid: adminUid, title: 'topic2', content: 'topic 2 mainpost', cid: cid2 });
			const tid2 = anotherTopic.tid;
			const topic2LastReply = await topics.reply({ uid: adminUid, content: 'topic 2 reply 1', tid: tid2 });

			async function checkCidSets(post1, post2) {
				const [topicData, scores1, scores2, posts1, posts2] = await Promise.all([
					topics.getTopicsFields([tid1, tid2], ['lastposttime', 'postcount']),
					db.sortedSetsScore([
						`cid:${cid1}:tids`,
						`cid:${cid1}:tids:lastposttime`,
						`cid:${cid1}:tids:posts`,
					], tid1),
					db.sortedSetsScore([
						`cid:${cid2}:tids`,
						`cid:${cid2}:tids:lastposttime`,
						`cid:${cid2}:tids:posts`,
					], tid2),
					db.getSortedSetRangeWithScores(`tid:${tid1}:posts`, 0, -1),
					db.getSortedSetRangeWithScores(`tid:${tid2}:posts`, 0, -1),
				]);
				const assertMsg = `${JSON.stringify(posts1)}\n${JSON.stringify(posts2)}`;
				assert.equal(topicData[0].postcount, scores1[2], assertMsg);
				assert.equal(topicData[1].postcount, scores2[2], assertMsg);
				assert.equal(topicData[0].lastposttime, post1.timestamp, assertMsg);
				assert.equal(topicData[1].lastposttime, post2.timestamp, assertMsg);
				assert.equal(topicData[0].lastposttime, scores1[0], assertMsg);
				assert.equal(topicData[1].lastposttime, scores2[0], assertMsg);
				assert.equal(topicData[0].lastposttime, scores1[1], assertMsg);
				assert.equal(topicData[1].lastposttime, scores2[1], assertMsg);
			}

			await checkCidSets(movedPost, topic2LastReply);

			let isMember = await db.isMemberOfSortedSets([`cid:${cid1}:pids`, `cid:${cid2}:pids`], movedPost.pid);
			assert.deepEqual(isMember, [true, false]);

			let categoryData = await categories.getCategoriesFields([cid1, cid2], ['post_count']);
			assert.equal(categoryData[0].post_count, 4);
			assert.equal(categoryData[1].post_count, 2);

			await topics.movePostToTopic(1, movedPost.pid, tid2);

			await checkCidSets(previousPost, topic2LastReply);

			isMember = await db.isMemberOfSortedSets([`cid:${cid1}:pids`, `cid:${cid2}:pids`], movedPost.pid);
			assert.deepEqual(isMember, [false, true]);

			categoryData = await categories.getCategoriesFields([cid1, cid2], ['post_count']);
			assert.equal(categoryData[0].post_count, 3);
			assert.equal(categoryData[1].post_count, 3);
		});

		it('should fail to purge topic if user does not have privilege', async () => {
			const topic1 = await topics.post({
				uid: adminUid,
				title: 'topic for purge test',
				content: 'topic content',
				cid: categoryObj.cid,
			});
			const tid1 = topic1.topicData.tid;
			const globalModUid = await User.create({ username: 'global mod' });
			await groups.join('Global Moderators', globalModUid);
			await privileges.categories.rescind(['groups:purge'], categoryObj.cid, 'Global Moderators');
			try {
				await apiTopics.purge({ uid: globalModUid }, { tids: [tid1], cid: categoryObj.cid });
			} catch (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				await privileges.categories.give(['groups:purge'], categoryObj.cid, 'Global Moderators');
				return;
			}
			assert(false);
		});

		it('should purge the topic', async () => {
			await apiTopics.purge({ uid: adminUid }, { tids: [newTopic.tid], cid: categoryObj.cid });
			const isMember = await db.isSortedSetMember(`uid:${followerUid}:followed_tids`, newTopic.tid);
			assert.strictEqual(false, isMember);
		});

		it('should not allow user to restore their topic if it was deleted by an admin', async () => {
			const result = await topics.post({
				uid: fooUid,
				title: 'topic for restore test',
				content: 'topic content',
				cid: categoryObj.cid,
			});
			await apiTopics.delete({ uid: adminUid }, { tids: [result.topicData.tid], cid: categoryObj.cid });
			try {
				await apiTopics.restore({ uid: fooUid }, { tids: [result.topicData.tid], cid: categoryObj.cid });
			} catch (err) {
				return assert.strictEqual(err.message, '[[error:no-privileges]]');
			}
			assert(false);
		});
	});

	describe('order pinned topics', () => {
		let tid1;
		let tid2;
		let tid3;
		before(async () => {
			async function createTopic() {
				return (await topics.post({
					uid: topic.userId,
					title: 'topic for test',
					content: 'topic content',
					cid: topic.categoryId,
				})).topicData.tid;
			}
			tid1 = await createTopic();
			tid2 = await createTopic();
			tid3 = await createTopic();
			await topics.tools.pin(tid1, adminUid);
			// artificial timeout so pin time is different on redis sometimes scores are indentical
			await sleep(5);
			await topics.tools.pin(tid2, adminUid);
		});

		const socketTopics = require('../src/socket.io/topics');
		it('should error with invalid data', (done) => {
			socketTopics.orderPinnedTopics({ uid: adminUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error with invalid data', (done) => {
			socketTopics.orderPinnedTopics({ uid: adminUid }, [null, null], (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error with unprivileged user', (done) => {
			socketTopics.orderPinnedTopics({ uid: 0 }, { tid: tid1, order: 1 }, (err) => {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should not do anything if topics are not pinned', (done) => {
			socketTopics.orderPinnedTopics({ uid: adminUid }, { tid: tid3, order: 1 }, (err) => {
				assert.ifError(err);
				db.isSortedSetMember(`cid:${topic.categoryId}:tids:pinned`, tid3, (err, isMember) => {
					assert.ifError(err);
					assert(!isMember);
					done();
				});
			});
		});

		it('should order pinned topics', (done) => {
			db.getSortedSetRevRange(`cid:${topic.categoryId}:tids:pinned`, 0, -1, (err, pinnedTids) => {
				assert.ifError(err);
				assert.equal(pinnedTids[0], tid2);
				assert.equal(pinnedTids[1], tid1);
				socketTopics.orderPinnedTopics({ uid: adminUid }, { tid: tid1, order: 0 }, (err) => {
					assert.ifError(err);
					db.getSortedSetRevRange(`cid:${topic.categoryId}:tids:pinned`, 0, -1, (err, pinnedTids) => {
						assert.ifError(err);
						assert.equal(pinnedTids[0], tid1);
						assert.equal(pinnedTids[1], tid2);
						done();
					});
				});
			});
		});
	});


	describe('.ignore', () => {
		let newTid;
		let uid;
		let newTopic;
		before(async () => {
			uid = topic.userId;
			const result = await topics.post({ uid: topic.userId, title: 'Topic to be ignored', content: 'Just ignore me, please!', cid: topic.categoryId });
			newTopic = result.topicData;
			newTid = newTopic.tid;
			await topics.markUnread(newTid, uid);
		});

		it('should not appear in the unread list', async () => {
			await topics.ignore(newTid, uid);
			const { topics: topicData } = await topics.getUnreadTopics({ cid: 0, uid: uid, start: 0, stop: -1, filter: '' });
			const tids = topicData.map(topic => topic.tid);
			assert.equal(tids.indexOf(newTid), -1, 'The topic appeared in the unread list.');
		});

		it('should not appear as unread in the recent list', async () => {
			await topics.ignore(newTid, uid);
			const results = await topics.getLatestTopics({
				uid: uid,
				start: 0,
				stop: -1,
				term: 'year',
			});

			const { topics: topicsData } = results;
			let topic;
			let i;
			for (i = 0; i < topicsData.length; i += 1) {
				if (topicsData[i].tid === parseInt(newTid, 10)) {
					assert.equal(false, topicsData[i].unread, 'ignored topic was marked as unread in recent list');
					return;
				}
			}
			assert.ok(topic, 'topic didn\'t appear in the recent list');
		});

		it('should appear as unread again when marked as following', async () => {
			await topics.ignore(newTid, uid);
			await topics.follow(newTid, uid);
			const results = await topics.getUnreadTopics({ cid: 0, uid: uid, start: 0, stop: -1, filter: '' });
			const tids = results.topics.map(topic => topic.tid);
			assert.ok(tids.includes(newTid), 'The topic did not appear in the unread list.');
		});
	});

	describe('.fork', () => {
		let newTopic;
		const replies = [];
		let topicPids;
		const originalBookmark = 6;
		async function postReply() {
			const result = await topics.reply({ uid: topic.userId, content: `test post ${replies.length}`, tid: newTopic.tid });
			assert.ok(result);
			replies.push(result);
		}

		before(async () => {
			await groups.join('administrators', topic.userId);
			({ topicData: newTopic } = await topics.post({
				uid: topic.userId,
				title: topic.title,
				content: topic.content,
				cid: topic.categoryId,
			}));
			for (let i = 0; i < 12; i++) {
				// eslint-disable-next-line no-await-in-loop
				await postReply();
			}
			topicPids = replies.map(reply => reply.pid);
			await socketTopics.bookmark({ uid: topic.userId }, { tid: newTopic.tid, index: originalBookmark });
		});

		it('should fail with invalid data', (done) => {
			socketTopics.bookmark({ uid: topic.userId }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should have 12 replies', (done) => {
			assert.equal(12, replies.length);
			done();
		});

		it('should fail with invalid data', (done) => {
			socketTopics.createTopicFromPosts({ uid: 0 }, null, (err) => {
				assert.equal(err.message, '[[error:not-logged-in]]');
				done();
			});
		});

		it('should fail with invalid data', (done) => {
			socketTopics.createTopicFromPosts({ uid: adminUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should not update the user\'s bookmark', async () => {
			await socketTopics.createTopicFromPosts({ uid: topic.userId }, {
				title: 'Fork test, no bookmark update',
				pids: topicPids.slice(-2),
				fromTid: newTopic.tid,
			});
			const bookmark = await topics.getUserBookmark(newTopic.tid, topic.userId);
			assert.equal(originalBookmark, bookmark);
		});

		it('should update the user\'s bookmark ', async () => {
			await topics.createTopicFromPosts(
				topic.userId,
				'Fork test, no bookmark update',
				topicPids.slice(1, 3),
				newTopic.tid,
			);
			const bookmark = await topics.getUserBookmark(newTopic.tid, topic.userId);
			assert.equal(originalBookmark - 2, bookmark);
		});

		it('should properly update topic vote count after forking', async () => {
			const result = await topics.post({ uid: fooUid, cid: categoryObj.cid, title: 'fork vote test', content: 'main post' });
			const reply1 = await topics.reply({ tid: result.topicData.tid, uid: fooUid, content: 'test reply 1' });
			const reply2 = await topics.reply({ tid: result.topicData.tid, uid: fooUid, content: 'test reply 2' });
			const reply3 = await topics.reply({ tid: result.topicData.tid, uid: fooUid, content: 'test reply 3' });
			await posts.upvote(result.postData.pid, adminUid);
			await posts.upvote(reply1.pid, adminUid);
			assert.strictEqual(await db.sortedSetScore('topics:votes', result.topicData.tid), 1);
			assert.strictEqual(await db.sortedSetScore(`cid:${categoryObj.cid}:tids:votes`, result.topicData.tid), 1);
			const newTopic = await topics.createTopicFromPosts(adminUid, 'Fork test, vote update', [reply1.pid, reply2.pid], result.topicData.tid);

			assert.strictEqual(await db.sortedSetScore('topics:votes', newTopic.tid), 1);
			assert.strictEqual(await db.sortedSetScore(`cid:${categoryObj.cid}:tids:votes`, newTopic.tid), 1);
			assert.strictEqual(await topics.getTopicField(newTopic.tid, 'upvotes'), 1);
		});
	});

	describe('controller', () => {
		let topicData;

		before((done) => {
			topics.post({
				uid: topic.userId,
				title: 'topic for controller test',
				content: 'topic content',
				cid: topic.categoryId,
				thumb: 'http://i.imgur.com/64iBdBD.jpg',
			}, (err, result) => {
				assert.ifError(err);
				assert.ok(result);
				topicData = result.topicData;
				done();
			});
		});

		it('should load topic', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/topic/${topicData.slug}`);
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load topic api data', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/topic/${topicData.slug}`);
			assert.equal(response.statusCode, 200);
			assert.strictEqual(body._header.tags.meta.find(t => t.name === 'description').content, 'topic content');
			assert.strictEqual(body._header.tags.meta.find(t => t.property === 'og:description').content, 'topic content');
		});

		it('should 404 if post index is invalid', async () => {
			const { response } = await request.get(`${nconf.get('url')}/topic/${topicData.slug}/derp`);
			assert.equal(response.statusCode, 404);
		});

		it('should 404 if topic does not exist', async () => {
			const { response } = await request.get(`${nconf.get('url')}/topic/123123/does-not-exist`);
			assert.equal(response.statusCode, 404);
		});

		it('should 401 if not allowed to read as guest', async () => {
			const privileges = require('../src/privileges');
			await privileges.categories.rescind(['groups:topics:read'], topicData.cid, 'guests');

			const { response, body } = await request.get(`${nconf.get('url')}/api/topic/${topicData.slug}`);
			assert.equal(response.statusCode, 401);
			assert(body);
			await privileges.categories.give(['groups:topics:read'], topicData.cid, 'guests');
		});

		it('should redirect to correct topic if slug is missing', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/topic/${topicData.tid}/herpderp/1?page=2`);
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should redirect if post index is out of range', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/topic/${topicData.slug}/-1`);
			assert.equal(response.statusCode, 200);
			assert.equal(response.headers['x-redirect'], encodeURIComponent(`/topic/${topicData.tid}/topic-for-controller-test`));
			assert.equal(body, `/topic/${topicData.tid}/topic-for-controller-test`);
		});

		it('should 404 if page is out of bounds', async () => {
			const meta = require('../src/meta');
			meta.config.usePagination = 1;
			const { response } = await request.get(`${nconf.get('url')}/topic/${topicData.slug}?page=100`);
			assert.equal(response.statusCode, 404);
		});

		it('should mark topic read', async () => {
			const { response } = await request.get(`${nconf.get('url')}/topic/${topicData.slug}`, {
				jar: adminJar,
			});
			assert.equal(response.statusCode, 200);
			const hasRead = await topics.hasReadTopics([topicData.tid], adminUid);
			assert.equal(hasRead[0], true);
		});

		it('should 404 if tid is not a number', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/topic/teaser/nan`);
			assert.equal(response.statusCode, 404);
		});

		it('should 403 if cant read', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/topic/teaser/${123123}`);
			assert.equal(response.statusCode, 403);
			assert.equal(body, '[[error:no-privileges]]');
		});

		it('should load topic teaser', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/topic/teaser/${topicData.tid}`);
			assert.equal(response.statusCode, 200);
			assert(body);
			assert.equal(body.tid, topicData.tid);
			assert.equal(body.content, 'topic content');
			assert(body.user);
			assert(body.topic);
			assert(body.category);
		});


		it('should 404 if tid is not a number', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/topic/pagination/nan`);
			assert.equal(response.statusCode, 404);
		});

		it('should 404 if tid does not exist', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/topic/pagination/1231231`);
			assert.equal(response.statusCode, 404);
		});

		it('should load pagination', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/topic/pagination/${topicData.tid}`);
			assert.equal(response.statusCode, 200);
			assert(body);
			assert.deepEqual(body.pagination, {
				prev: { page: 1, active: false },
				next: { page: 1, active: false },
				first: { page: 1, active: true },
				last: { page: 1, active: true },
				rel: [],
				pages: [],
				currentPage: 1,
				pageCount: 1,
			});
		});
	});


	describe('infinitescroll', () => {
		const socketTopics = require('../src/socket.io/topics');
		let tid;
		before((done) => {
			topics.post({
				uid: topic.userId,
				title: topic.title,
				content: topic.content,
				cid: topic.categoryId,
			}, (err, result) => {
				assert.ifError(err);
				tid = result.topicData.tid;
				done();
			});
		});

		it('should error with invalid data', (done) => {
			socketTopics.loadMore({ uid: adminUid }, {}, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should infinite load topic posts', (done) => {
			socketTopics.loadMore({ uid: adminUid }, { tid: tid, after: 0, count: 10 }, (err, data) => {
				assert.ifError(err);
				assert(data.posts);
				assert(data.privileges);
				done();
			});
		});
	});

	describe('suggested topics', () => {
		let tid1;
		let tid3;
		before(async () => {
			const topic1 = await topics.post({ uid: adminUid, tags: ['nodebb'], title: 'topic title 1', content: 'topic 1 content', cid: topic.categoryId });
			const topic2 = await topics.post({ uid: adminUid, tags: ['nodebb'], title: 'topic title 2', content: 'topic 2 content', cid: topic.categoryId });
			const topic3 = await topics.post({ uid: adminUid, tags: [], title: 'topic title 3', content: 'topic 3 content', cid: topic.categoryId });
			tid1 = topic1.topicData.tid;
			tid3 = topic3.topicData.tid;
		});

		it('should return suggested topics', (done) => {
			topics.getSuggestedTopics(tid1, adminUid, 0, -1, (err, topics) => {
				assert.ifError(err);
				assert(Array.isArray(topics));
				done();
			});
		});

		it('should return suggested topics', (done) => {
			topics.getSuggestedTopics(tid3, adminUid, 0, 2, (err, topics) => {
				assert.ifError(err);
				assert(Array.isArray(topics));
				done();
			});
		});
	});

	describe('unread', () => {
		const socketTopics = require('../src/socket.io/topics');
		let tid;
		let uid;
		before(async () => {
			const { topicData } = await topics.post({ uid: topic.userId, title: 'unread topic', content: 'unread topic content', cid: topic.categoryId });
			uid = await User.create({ username: 'regularJoe' });
			tid = topicData.tid;
		});

		it('should fail with invalid data', async () => {
			await assert.rejects(
				apiTopics.markUnread({ uid: adminUid }, { tid: null }),
				{ message: '[[error:invalid-data]]' }
			);
		});

		it('should fail if topic does not exist', async () => {
			await assert.rejects(
				apiTopics.markUnread({ uid: adminUid }, { tid: 1231082 }),
				{ message: '[[error:no-topic]]' }
			);
		});

		it('should mark topic unread', async () => {
			await apiTopics.markUnread({ uid: adminUid }, { tid });
			const hasRead = await topics.hasReadTopic(tid, adminUid);
			assert.strictEqual(hasRead, false);
		});

		it('should fail with invalid data', (done) => {
			socketTopics.markAsRead({ uid: 0 }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should mark topic read', (done) => {
			socketTopics.markAsRead({ uid: adminUid }, [tid], (err) => {
				assert.ifError(err);
				topics.hasReadTopic(tid, adminUid, (err, hasRead) => {
					assert.ifError(err);
					assert(hasRead);
					done();
				});
			});
		});

		it('should fail with invalid data', (done) => {
			socketTopics.markTopicNotificationsRead({ uid: 0 }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should mark topic notifications read', async () => {
			await apiTopics.follow({ uid: adminUid }, { tid: tid });
			const data = await topics.reply({ uid: uid, timestamp: Date.now(), content: 'some content', tid: tid });
			await sleep(2500);
			let count = await User.notifications.getUnreadCount(adminUid);
			assert.strictEqual(count, 1);
			await socketTopics.markTopicNotificationsRead({ uid: adminUid }, [tid]);
			count = await User.notifications.getUnreadCount(adminUid);
			assert.strictEqual(count, 0);
		});

		it('should fail with invalid data', (done) => {
			socketTopics.markAllRead({ uid: 0 }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-uid]]');
				done();
			});
		});

		it('should mark all read', (done) => {
			socketTopics.markUnread({ uid: adminUid }, tid, (err) => {
				assert.ifError(err);
				socketTopics.markAllRead({ uid: adminUid }, {}, (err) => {
					assert.ifError(err);
					topics.hasReadTopic(tid, adminUid, (err, hasRead) => {
						assert.ifError(err);
						assert(hasRead);
						done();
					});
				});
			});
		});

		it('should mark category topics read', (done) => {
			socketTopics.markUnread({ uid: adminUid }, tid, (err) => {
				assert.ifError(err);
				socketTopics.markCategoryTopicsRead({ uid: adminUid }, topic.categoryId, (err) => {
					assert.ifError(err);
					topics.hasReadTopic(tid, adminUid, (err, hasRead) => {
						assert.ifError(err);
						assert(hasRead);
						done();
					});
				});
			});
		});

		it('should fail with invalid data', async () => {
			await assert.rejects(
				apiTopics.bump({ uid: adminUid }, { tid: null }),
				{ message: '[[error:invalid-tid]]' }
			);
		});

		it('should fail with invalid data', async () => {
			await assert.rejects(
				apiTopics.bump({ uid: 0 }, { tid: [tid] }),
				{ message: '[[error:no-privileges]]' }
			);
		});

		it('should fail if user is not admin', async () => {
			await assert.rejects(
				apiTopics.bump({ uid: uid }, { tid }),
				{ message: '[[error:no-privileges]]' }
			);
		});

		it('should mark topic unread for everyone', async () => {
			await apiTopics.bump({ uid: adminUid }, { tid });
			const adminRead = await topics.hasReadTopic(tid, adminUid);
			const regularRead = await topics.hasReadTopic(tid, uid);

			assert.equal(adminRead, false);
			assert.equal(regularRead, false);
		});

		it('should not do anything if tids is empty array', (done) => {
			socketTopics.markAsRead({ uid: adminUid }, [], (err, markedRead) => {
				assert.ifError(err);
				assert(!markedRead);
				done();
			});
		});

		it('should not return topics in category you cant read', async () => {
			const { cid: privateCid } = await categories.create({
				name: 'private category',
				description: 'private category',
			});
			privileges.categories.rescind(['groups:topics:read'], privateCid, 'registered-users');

			const { topicData } = await topics.post({ uid: adminUid, title: 'topic in private category', content: 'registered-users cant see this', cid: privateCid });
			const privateTid = topicData.tid;

			const unreadTids = (await topics.getUnreadTids({ uid: uid })).map(String);
			assert(!unreadTids.includes(String(privateTid)));
		});

		it('should not return topics in category you ignored/not watching', async () => {
			const category = await categories.create({
				name: 'ignored category',
				description: 'ignored category',
			});
			const ignoredCid = category.cid;
			await privileges.categories.rescind(['groups:topics:read'], ignoredCid, 'registered-users');

			const { topicData } = await topics.post({ uid: adminUid, title: 'topic in private category', content: 'registered-users cant see this', cid: ignoredCid });
			const { tid } = topicData;

			await User.ignoreCategory(uid, ignoredCid);
			const unreadTids = (await topics.getUnreadTids({ uid: uid })).map(String);
			assert(!unreadTids.includes(String(tid)));
		});

		it('should not return topic as unread if new post is from blocked user', async () => {
			const { topicData } = await topics.post({ uid: adminUid, title: 'will not get as unread', content: 'not unread', cid: categoryObj.cid });
			const blockedUid = await User.create({ username: 'blockedunread' });
			await User.blocks.add(blockedUid, adminUid);
			await topics.reply({ uid: blockedUid, content: 'post from blocked user', tid: topic.tid });

			const unreadTids = await topics.getUnreadTids({ cid: 0, uid: adminUid });
			assert(!unreadTids.includes(topicData.tid));
			await User.blocks.remove(blockedUid, adminUid);
		});

		it('should not return topic as unread if topic is deleted', async () => {
			const uid = await User.create({ username: 'regularJoe' });
			const result = await topics.post({ uid: adminUid, title: 'deleted unread', content: 'not unread', cid: categoryObj.cid });
			await topics.delete(result.topicData.tid, adminUid);
			const unreadTids = await topics.getUnreadTids({ cid: 0, uid: uid });
			assert(!unreadTids.includes(result.topicData.tid));
		});
	});

	describe('tags', () => {
		const socketTopics = require('../src/socket.io/topics');
		const socketAdmin = require('../src/socket.io/admin');

		before(async () => {
			await topics.post({ uid: adminUid, tags: ['php', 'nosql', 'psql', 'nodebb', 'node icon'], title: 'topic title 1', content: 'topic 1 content', cid: topic.categoryId });
			await topics.post({ uid: adminUid, tags: ['javascript', 'mysql', 'python', 'nodejs'], title: 'topic title 2', content: 'topic 2 content', cid: topic.categoryId });
		});

		it('should return empty array if query is falsy', (done) => {
			socketTopics.autocompleteTags({ uid: adminUid }, { query: '' }, (err, data) => {
				assert.ifError(err);
				assert.deepEqual([], data);
				done();
			});
		});

		it('should autocomplete tags', (done) => {
			socketTopics.autocompleteTags({ uid: adminUid }, { query: 'p' }, (err, data) => {
				assert.ifError(err);
				['php', 'psql', 'python'].forEach((tag) => {
					assert.notEqual(data.indexOf(tag), -1);
				});
				done();
			});
		});

		it('should return empty array if query is falsy', (done) => {
			socketTopics.searchTags({ uid: adminUid }, { query: '' }, (err, data) => {
				assert.ifError(err);
				assert.deepEqual([], data);
				done();
			});
		});

		it('should search tags', (done) => {
			socketTopics.searchTags({ uid: adminUid }, { query: 'no' }, (err, data) => {
				assert.ifError(err);
				['nodebb', 'nodejs', 'nosql'].forEach((tag) => {
					assert.notEqual(data.indexOf(tag), -1);
				});
				done();
			});
		});

		it('should return empty array if query is falsy', (done) => {
			socketTopics.searchAndLoadTags({ uid: adminUid }, { query: '' }, (err, data) => {
				assert.ifError(err);
				assert.equal(data.matchCount, 0);
				assert.equal(data.pageCount, 1);
				assert.deepEqual(data.tags, []);
				done();
			});
		});

		it('should search and load tags', (done) => {
			socketTopics.searchAndLoadTags({ uid: adminUid }, { query: 'no' }, (err, data) => {
				assert.ifError(err);
				assert.equal(data.matchCount, 4);
				assert.equal(data.pageCount, 1);
				const tagData = [
					{ value: 'nodebb', valueEscaped: 'nodebb', valueEncoded: 'nodebb', score: 3, class: 'nodebb' },
					{ value: 'node icon', valueEscaped: 'node icon', valueEncoded: 'node%20icon', score: 1, class: 'node-icon' },
					{ value: 'nodejs', valueEscaped: 'nodejs', valueEncoded: 'nodejs', score: 1, class: 'nodejs' },
					{ value: 'nosql', valueEscaped: 'nosql', valueEncoded: 'nosql', score: 1, class: 'nosql' },
				];
				assert.deepEqual(data.tags, tagData);

				done();
			});
		});

		it('should return error if data is invalid', (done) => {
			socketTopics.loadMoreTags({ uid: adminUid }, { after: 'asd' }, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should load more tags', (done) => {
			socketTopics.loadMoreTags({ uid: adminUid }, { after: 0 }, (err, data) => {
				assert.ifError(err);
				assert(Array.isArray(data.tags));
				assert.equal(data.nextStart, 100);
				done();
			});
		});

		it('should error if data is invalid', (done) => {
			socketAdmin.tags.create({ uid: adminUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error if tag is invalid', (done) => {
			socketAdmin.tags.create({ uid: adminUid }, { tag: '' }, (err) => {
				assert.equal(err.message, '[[error:invalid-tag]]');
				done();
			});
		});

		it('should error if tag is too short', (done) => {
			socketAdmin.tags.create({ uid: adminUid }, { tag: 'as' }, (err) => {
				assert.equal(err.message, '[[error:tag-too-short]]');
				done();
			});
		});

		it('should create empty tag', (done) => {
			socketAdmin.tags.create({ uid: adminUid }, { tag: 'emptytag' }, (err) => {
				assert.ifError(err);
				db.sortedSetScore('tags:topic:count', 'emptytag', (err, score) => {
					assert.ifError(err);
					assert.equal(score, 0);
					done();
				});
			});
		});

		it('should do nothing if tag exists', (done) => {
			socketAdmin.tags.create({ uid: adminUid }, { tag: 'emptytag' }, (err) => {
				assert.ifError(err);
				db.sortedSetScore('tags:topic:count', 'emptytag', (err, score) => {
					assert.ifError(err);
					assert.equal(score, 0);
					done();
				});
			});
		});


		it('should rename tags', async () => {
			const result1 = await topics.post({ uid: adminUid, tags: ['plugins'], title: 'topic tagged with plugins', content: 'topic 1 content', cid: topic.categoryId });
			const result2 = await topics.post({ uid: adminUid, tags: ['plugin'], title: 'topic tagged with plugin', content: 'topic 2 content', cid: topic.categoryId });
			const data1 = await topics.getTopicData(result2.topicData.tid);

			await socketAdmin.tags.rename({ uid: adminUid }, [{
				value: 'plugin',
				newName: 'plugins',
			}]);

			const tids = await topics.getTagTids('plugins', 0, -1);
			assert.strictEqual(tids.length, 2);
			const tags = await topics.getTopicTags(result2.topicData.tid);

			const data = await topics.getTopicData(result2.topicData.tid);
			assert.strictEqual(tags.length, 1);
			assert.strictEqual(tags[0], 'plugins');
		});

		it('should return related topics', (done) => {
			const meta = require('../src/meta');
			meta.config.maximumRelatedTopics = 2;
			const topicData = {
				tags: [{ value: 'javascript' }],
			};
			topics.getRelatedTopics(topicData, 0, (err, data) => {
				assert.ifError(err);
				assert(Array.isArray(data));
				assert.equal(data[0].title, 'topic title 2');
				meta.config.maximumRelatedTopics = 0;
				done();
			});
		});

		it('should return error with invalid data', (done) => {
			socketAdmin.tags.deleteTags({ uid: adminUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should do nothing if arrays is empty', (done) => {
			socketAdmin.tags.deleteTags({ uid: adminUid }, { tags: [] }, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should delete tags', (done) => {
			socketAdmin.tags.create({ uid: adminUid }, { tag: 'emptytag2' }, (err) => {
				assert.ifError(err);
				socketAdmin.tags.deleteTags({ uid: adminUid }, { tags: ['emptytag', 'emptytag2', 'nodebb', 'nodejs'] }, (err) => {
					assert.ifError(err);
					db.getObjects(['tag:emptytag', 'tag:emptytag2'], (err, data) => {
						assert.ifError(err);
						assert(!data[0]);
						assert(!data[1]);
						done();
					});
				});
			});
		});

		it('should only delete one tag from topic', async () => {
			const result1 = await topics.post({ uid: adminUid, tags: ['deleteme1', 'deleteme2', 'deleteme3'], title: 'topic tagged with plugins', content: 'topic 1 content', cid: topic.categoryId });
			await topics.deleteTag('deleteme2');
			const topicData = await topics.getTopicData(result1.topicData.tid);
			const tags = topicData.tags.map(t => t.value);
			assert.deepStrictEqual(tags, ['deleteme1', 'deleteme3']);
		});

		it('should delete tag', (done) => {
			topics.deleteTag('javascript', (err) => {
				assert.ifError(err);
				db.getObject('tag:javascript', (err, data) => {
					assert.ifError(err);
					assert(!data);
					done();
				});
			});
		});

		it('should delete category tag as well', async () => {
			const category = await categories.create({ name: 'delete category' });
			const { cid } = category;
			await topics.post({ uid: adminUid, tags: ['willbedeleted', 'notthis'], title: 'tag topic', content: 'topic 1 content', cid: cid });
			let categoryTags = await topics.getCategoryTags(cid, 0, -1);
			assert(categoryTags.includes('willbedeleted'));
			assert(categoryTags.includes('notthis'));
			await topics.deleteTags(['willbedeleted']);
			categoryTags = await topics.getCategoryTags(cid, 0, -1);
			assert(!categoryTags.includes('willbedeleted'));
			assert(categoryTags.includes('notthis'));
		});

		it('should add and remove tags from topics properly', async () => {
			const category = await categories.create({ name: 'add/remove category' });
			const { cid } = category;
			const result = await topics.post({ uid: adminUid, tags: ['tag4', 'tag2', 'tag1', 'tag3'], title: 'tag topic', content: 'topic 1 content', cid: cid });
			const { tid } = result.topicData;

			let tags = await topics.getTopicTags(tid);
			let categoryTags = await topics.getCategoryTags(cid, 0, -1);
			assert.deepStrictEqual(tags.sort(), ['tag1', 'tag2', 'tag3', 'tag4']);
			assert.deepStrictEqual(categoryTags.sort(), ['tag1', 'tag2', 'tag3', 'tag4']);

			await topics.addTags(['tag7', 'tag6', 'tag5'], [tid]);
			tags = await topics.getTopicTags(tid);
			categoryTags = await topics.getCategoryTags(cid, 0, -1);
			assert.deepStrictEqual(tags.sort(), ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7']);
			assert.deepStrictEqual(categoryTags.sort(), ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7']);

			await topics.removeTags(['tag1', 'tag3', 'tag5', 'tag7'], [tid]);
			tags = await topics.getTopicTags(tid);
			categoryTags = await topics.getCategoryTags(cid, 0, -1);
			assert.deepStrictEqual(tags.sort(), ['tag2', 'tag4', 'tag6']);
			assert.deepStrictEqual(categoryTags.sort(), ['tag2', 'tag4', 'tag6']);
		});

		it('should respect minTags', async () => {
			const oldValue = meta.config.minimumTagsPerTopic;
			meta.config.minimumTagsPerTopic = 2;
			let err;
			try {
				await topics.post({ uid: adminUid, tags: ['tag4'], title: 'tag topic', content: 'topic 1 content', cid: topic.categoryId });
			} catch (_err) {
				err = _err;
			}
			assert.equal(err.message, `[[error:not-enough-tags, ${meta.config.minimumTagsPerTopic}]]`);
			meta.config.minimumTagsPerTopic = oldValue;
		});

		it('should respect maxTags', async () => {
			const oldValue = meta.config.maximumTagsPerTopic;
			meta.config.maximumTagsPerTopic = 2;
			let err;
			try {
				await topics.post({ uid: adminUid, tags: ['tag1', 'tag2', 'tag3'], title: 'tag topic', content: 'topic 1 content', cid: topic.categoryId });
			} catch (_err) {
				err = _err;
			}
			assert.equal(err.message, `[[error:too-many-tags, ${meta.config.maximumTagsPerTopic}]]`);
			meta.config.maximumTagsPerTopic = oldValue;
		});

		it('should respect minTags per category', async () => {
			const minTags = 2;
			await categories.setCategoryField(topic.categoryId, 'minTags', minTags);
			let err;
			try {
				await topics.post({ uid: adminUid, tags: ['tag4'], title: 'tag topic', content: 'topic 1 content', cid: topic.categoryId });
			} catch (_err) {
				err = _err;
			}
			assert.equal(err.message, `[[error:not-enough-tags, ${minTags}]]`);
			await db.deleteObjectField(`category:${topic.categoryId}`, 'minTags');
		});

		it('should respect maxTags per category', async () => {
			const maxTags = 2;
			await categories.setCategoryField(topic.categoryId, 'maxTags', maxTags);
			let err;
			try {
				await topics.post({ uid: adminUid, tags: ['tag1', 'tag2', 'tag3'], title: 'tag topic', content: 'topic 1 content', cid: topic.categoryId });
			} catch (_err) {
				err = _err;
			}
			assert.equal(err.message, `[[error:too-many-tags, ${maxTags}]]`);
			await db.deleteObjectField(`category:${topic.categoryId}`, 'maxTags');
		});

		it('should create and delete category tags properly', async () => {
			const category = await categories.create({ name: 'tag category 2' });
			const { cid } = category;
			const title = 'test title';
			const postResult = await topics.post({ uid: adminUid, tags: ['cattag1', 'cattag2', 'cattag3'], title: title, content: 'topic 1 content', cid: cid });
			await topics.post({ uid: adminUid, tags: ['cattag1', 'cattag2'], title: title, content: 'topic 1 content', cid: cid });
			await topics.post({ uid: adminUid, tags: ['cattag1'], title: title, content: 'topic 1 content', cid: cid });
			let result = await topics.getCategoryTagsData(cid, 0, -1);
			assert.deepStrictEqual(result, [
				{ value: 'cattag1', score: 3, valueEscaped: 'cattag1', valueEncoded: 'cattag1', class: 'cattag1' },
				{ value: 'cattag2', score: 2, valueEscaped: 'cattag2', valueEncoded: 'cattag2', class: 'cattag2' },
				{ value: 'cattag3', score: 1, valueEscaped: 'cattag3', valueEncoded: 'cattag3', class: 'cattag3' },
			]);

			// after purging values should update properly
			await topics.purge(postResult.topicData.tid, adminUid);
			result = await topics.getCategoryTagsData(cid, 0, -1);
			assert.deepStrictEqual(result, [
				{ value: 'cattag1', score: 2, valueEscaped: 'cattag1', valueEncoded: 'cattag1', class: 'cattag1' },
				{ value: 'cattag2', score: 1, valueEscaped: 'cattag2', valueEncoded: 'cattag2', class: 'cattag2' },
			]);
		});

		it('should update counts correctly if topic is moved between categories', async () => {
			const category1 = await categories.create({ name: 'tag category 2' });
			const category2 = await categories.create({ name: 'tag category 2' });
			const cid1 = category1.cid;
			const cid2 = category2.cid;

			const title = 'test title';
			const postResult = await topics.post({ uid: adminUid, tags: ['movedtag1', 'movedtag2'], title: title, content: 'topic 1 content', cid: cid1 });

			await topics.post({ uid: adminUid, tags: ['movedtag1'], title: title, content: 'topic 1 content', cid: cid1 });
			await topics.post({ uid: adminUid, tags: ['movedtag2'], title: title, content: 'topic 1 content', cid: cid2 });

			let result1 = await topics.getCategoryTagsData(cid1, 0, -1);
			let result2 = await topics.getCategoryTagsData(cid2, 0, -1);
			assert.deepStrictEqual(result1, [
				{ value: 'movedtag1', score: 2, valueEscaped: 'movedtag1', valueEncoded: 'movedtag1', class: 'movedtag1' },
				{ value: 'movedtag2', score: 1, valueEscaped: 'movedtag2', valueEncoded: 'movedtag2', class: 'movedtag2' },
			]);
			assert.deepStrictEqual(result2, [
				{ value: 'movedtag2', score: 1, valueEscaped: 'movedtag2', valueEncoded: 'movedtag2', class: 'movedtag2' },
			]);

			// after moving values should update properly
			await topics.tools.move(postResult.topicData.tid, { cid: cid2, uid: adminUid });

			result1 = await topics.getCategoryTagsData(cid1, 0, -1);
			result2 = await topics.getCategoryTagsData(cid2, 0, -1);
			assert.deepStrictEqual(result1, [
				{ value: 'movedtag1', score: 1, valueEscaped: 'movedtag1', valueEncoded: 'movedtag1', class: 'movedtag1' },
			]);
			assert.deepStrictEqual(result2, [
				{ value: 'movedtag2', score: 2, valueEscaped: 'movedtag2', valueEncoded: 'movedtag2', class: 'movedtag2' },
				{ value: 'movedtag1', score: 1, valueEscaped: 'movedtag1', valueEncoded: 'movedtag1', class: 'movedtag1' },
			]);
		});

		it('should not allow regular user to use system tags', async () => {
			const oldValue = meta.config.systemTags;
			meta.config.systemTags = 'moved,locked';
			let err;
			try {
				await topics.post({
					uid: fooUid,
					tags: ['locked'],
					title: 'i cant use this',
					content: 'topic 1 content',
					cid: categoryObj.cid,
				});
			} catch (_err) {
				err = _err;
			}
			assert.strictEqual(err.message, '[[error:cant-use-system-tag]]');
			meta.config.systemTags = oldValue;
		});

		it('should allow admin user to use system tags', async () => {
			const oldValue = meta.config.systemTags;
			meta.config.systemTags = 'moved,locked';
			const result = await topics.post({
				uid: adminUid,
				tags: ['locked'],
				title: 'I can use this tag',
				content: 'topic 1 content',
				cid: categoryObj.cid,
			});
			assert.strictEqual(result.topicData.tags[0].value, 'locked');
			meta.config.systemTags = oldValue;
		});

		it('should not error if regular user edits topic after admin adds system tags', async () => {
			const oldValue = meta.config.systemTags;
			meta.config.systemTags = 'moved,locked';
			const result = await topics.post({
				uid: fooUid,
				tags: ['one', 'two'],
				title: 'topic with 2 tags',
				content: 'topic content',
				cid: categoryObj.cid,
			});
			await posts.edit({
				pid: result.postData.pid,
				uid: adminUid,
				content: 'edited content',
				tags: ['one', 'two', 'moved'],
			});
			await posts.edit({
				pid: result.postData.pid,
				uid: fooUid,
				content: 'edited content',
				tags: ['one', 'moved', 'two'],
			});
			const tags = await topics.getTopicTags(result.topicData.tid);
			assert.deepStrictEqual(tags.sort(), ['moved', 'one', 'two']);
			meta.config.systemTags = oldValue;
		});
	});

	describe('follow/unfollow', () => {
		const socketTopics = require('../src/socket.io/topics');
		let tid;
		let followerUid;
		before((done) => {
			User.create({ username: 'follower' }, (err, uid) => {
				if (err) {
					return done(err);
				}
				followerUid = uid;
				topics.post({ uid: adminUid, title: 'topic title', content: 'some content', cid: topic.categoryId }, (err, result) => {
					if (err) {
						return done(err);
					}
					tid = result.topicData.tid;
					done();
				});
			});
		});

		it('should error if not logged in', async () => {
			try {
				await apiTopics.ignore({ uid: 0 }, { tid: tid });
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:not-logged-in]]');
			}
		});

		it('should filter ignoring uids', async () => {
			await apiTopics.ignore({ uid: followerUid }, { tid: tid });
			const uids = await topics.filterIgnoringUids(tid, [adminUid, followerUid]);
			assert.equal(uids.length, 1);
			assert.equal(uids[0], adminUid);
		});

		it('should error with topic that does not exist', async () => {
			try {
				await apiTopics.follow({ uid: followerUid }, { tid: -1 });
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:no-topic]]');
			}
		});

		it('should follow topic', (done) => {
			topics.toggleFollow(tid, followerUid, (err, isFollowing) => {
				assert.ifError(err);
				assert(isFollowing);
				socketTopics.isFollowed({ uid: followerUid }, tid, (err, isFollowing) => {
					assert.ifError(err);
					assert(isFollowing);
					done();
				});
			});
		});
	});

	describe('topics search', () => {
		it('should error with invalid data', async () => {
			try {
				await topics.search(null, null);
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
			}
		});

		it('should return results', async () => {
			const plugins = require('../src/plugins');
			plugins.hooks.register('myTestPlugin', {
				hook: 'filter:topic.search',
				method: function (data, callback) {
					callback(null, [1, 2, 3]);
				},
			});
			const results = await topics.search(topic.tid, 'test');
			assert.deepEqual(results, [1, 2, 3]);
		});
	});

	it('should check if user is moderator', (done) => {
		socketTopics.isModerator({ uid: adminUid }, topic.tid, (err, isModerator) => {
			assert.ifError(err);
			assert(!isModerator);
			done();
		});
	});

	describe('next post index', () => {
		it('should error with invalid data', async () => {
			await assert.rejects(socketTopics.getMyNextPostIndex({ uid: 1 }, null), { message: '[[error:invalid-data]]' });
			await assert.rejects(socketTopics.getMyNextPostIndex({ uid: 1 }, {}), { message: '[[error:invalid-data]]' });
			await assert.rejects(socketTopics.getMyNextPostIndex({ uid: 1 }, { tid: 1 }), { message: '[[error:invalid-data]]' });
			await assert.rejects(socketTopics.getMyNextPostIndex({ uid: 1 }, { tid: 1, index: 1 }), { message: '[[error:invalid-data]]' });
		});

		it('should return 0 if user has no posts in topic', async () => {
			const uid = await User.create({ username: 'indexposter' });
			const t = await topics.post({ uid: uid, title: 'topic 1', content: 'content 1', cid: categoryObj.cid });
			const index = await socketTopics.getMyNextPostIndex({ uid: adminUid }, { tid: t.topicData.tid, index: 1, sort: 'oldest_to_newest' });
			assert.strictEqual(index, 0);
		});

		it('should get users next post index in topic', async () => {
			const t = await topics.post({ uid: adminUid, title: 'topic 1', content: 'content 1', cid: categoryObj.cid });
			await topics.reply({ uid: adminUid, content: 'reply 1 content', tid: t.topicData.tid });
			await topics.reply({ uid: adminUid, content: 'reply 2 content', tid: t.topicData.tid });
			const index = await socketTopics.getMyNextPostIndex({ uid: adminUid }, { tid: t.topicData.tid, index: 1, sort: 'oldest_to_newest' });
			assert.strictEqual(index, 1);
		});

		it('should get users next post index in topic by wrapping around', async () => {
			const cat = await categories.create({ name: 'tag category' });
			const t = await topics.post({ uid: adminUid, title: 'topic 1', content: 'content 1', cid: cat.cid });
			await topics.reply({ uid: adminUid, content: 'reply 1 content', tid: t.topicData.tid });
			await topics.reply({ uid: adminUid, content: 'reply 2 content', tid: t.topicData.tid });
			let index = await socketTopics.getMyNextPostIndex({ uid: adminUid }, { tid: t.topicData.tid, index: 2, sort: 'oldest_to_newest' });
			assert.strictEqual(index, 2);
			index = await socketTopics.getMyNextPostIndex({ uid: adminUid }, { tid: t.topicData.tid, index: 3, sort: 'oldest_to_newest' });
			assert.strictEqual(index, 1);
		});
	});


	describe('teasers', () => {
		let topic1;
		let topic2;
		before(async () => {
			topic1 = await topics.post({ uid: adminUid, title: 'topic 1', content: 'content 1', cid: categoryObj.cid });
			topic2 = await topics.post({ uid: adminUid, title: 'topic 2', content: 'content 2', cid: categoryObj.cid });
		});

		after((done) => {
			meta.config.teaserPost = '';
			done();
		});


		it('should return empty array if first param is empty', (done) => {
			topics.getTeasers([], 1, (err, teasers) => {
				assert.ifError(err);
				assert.equal(0, teasers.length);
				done();
			});
		});

		it('should get teasers with 2 params', (done) => {
			topics.getTeasers([topic1.topicData, topic2.topicData], 1, (err, teasers) => {
				assert.ifError(err);
				assert.deepEqual([undefined, undefined], teasers);
				done();
			});
		});

		it('should get teasers with first posts', (done) => {
			meta.config.teaserPost = 'first';
			topics.getTeasers([topic1.topicData, topic2.topicData], 1, (err, teasers) => {
				assert.ifError(err);
				assert.equal(2, teasers.length);
				assert(teasers[0]);
				assert(teasers[1]);
				assert(teasers[0].tid, topic1.topicData.tid);
				assert(teasers[0].content, 'content 1');
				assert(teasers[0].user.username, 'admin');
				done();
			});
		});

		it('should get teasers even if one topic is falsy', (done) => {
			topics.getTeasers([null, topic2.topicData], 1, (err, teasers) => {
				assert.ifError(err);
				assert.equal(2, teasers.length);
				assert.equal(undefined, teasers[0]);
				assert(teasers[1]);
				assert(teasers[1].tid, topic2.topicData.tid);
				assert(teasers[1].content, 'content 2');
				assert(teasers[1].user.username, 'admin');
				done();
			});
		});

		it('should get teasers with last posts', (done) => {
			meta.config.teaserPost = 'last-post';
			topics.reply({ uid: adminUid, content: 'reply 1 content', tid: topic1.topicData.tid }, (err, result) => {
				assert.ifError(err);
				topic1.topicData.teaserPid = result.pid;
				topics.getTeasers([topic1.topicData, topic2.topicData], 1, (err, teasers) => {
					assert.ifError(err);
					assert(teasers[0]);
					assert(teasers[1]);
					assert(teasers[0].tid, topic1.topicData.tid);
					assert(teasers[0].content, 'reply 1 content');
					done();
				});
			});
		});

		it('should get teasers by tids', (done) => {
			topics.getTeasersByTids([topic2.topicData.tid, topic1.topicData.tid], 1, (err, teasers) => {
				assert.ifError(err);
				assert(2, teasers.length);
				assert.equal(teasers[1].content, 'reply 1 content');
				done();
			});
		});

		it('should return empty array ', (done) => {
			topics.getTeasersByTids([], 1, (err, teasers) => {
				assert.ifError(err);
				assert.equal(0, teasers.length);
				done();
			});
		});

		it('should get teaser by tid', (done) => {
			topics.getTeaser(topic2.topicData.tid, 1, (err, teaser) => {
				assert.ifError(err);
				assert(teaser);
				assert.equal(teaser.content, 'content 2');
				done();
			});
		});

		it('should not return teaser if user is blocked', async () => {
			const blockedUid = await User.create({ username: 'blocked' });
			await User.blocks.add(blockedUid, adminUid);
			await topics.reply({ uid: blockedUid, content: 'post from blocked user', tid: topic2.topicData.tid });
			const teaser = await topics.getTeaser(topic2.topicData.tid, adminUid);
			assert.equal(teaser.content, 'content 2');
			await User.blocks.remove(blockedUid, adminUid);
		});
	});

	describe('tag privilege', () => {
		let uid;
		let cid;
		before(async () => {
			uid = await User.create({ username: 'tag_poster' });
			const category = await categories.create({ name: 'tag category' });
			cid = category.cid;
		});

		it('should fail to post if user does not have tag privilege', (done) => {
			privileges.categories.rescind(['groups:topics:tag'], cid, 'registered-users', (err) => {
				assert.ifError(err);
				topics.post({ uid: uid, cid: cid, tags: ['tag1'], title: 'topic with tags', content: 'some content here' }, (err) => {
					assert.equal(err.message, '[[error:no-privileges]]');
					done();
				});
			});
		});

		it('should fail to edit if user does not have tag privilege', (done) => {
			topics.post({ uid: uid, cid: cid, title: 'topic with tags', content: 'some content here' }, (err, result) => {
				assert.ifError(err);
				const { pid } = result.postData;
				posts.edit({ pid: pid, uid: uid, content: 'edited content', tags: ['tag2'] }, (err) => {
					assert.equal(err.message, '[[error:no-privileges]]');
					done();
				});
			});
		});

		it('should be able to edit topic and add tags if allowed', (done) => {
			privileges.categories.give(['groups:topics:tag'], cid, 'registered-users', (err) => {
				assert.ifError(err);
				topics.post({ uid: uid, cid: cid, tags: ['tag1'], title: 'topic with tags', content: 'some content here' }, (err, result) => {
					assert.ifError(err);
					posts.edit({ pid: result.postData.pid, uid: uid, content: 'edited content', tags: ['tag1', 'tag2'] }, (err, result) => {
						assert.ifError(err);
						const tags = result.topic.tags.map(tag => tag.value);
						assert(tags.includes('tag1'));
						assert(tags.includes('tag2'));
						done();
					});
				});
			});
		});
	});

	describe('topic merge', () => {
		let uid;
		let topic1Data;
		let topic2Data;

		async function getTopic(tid) {
			const topicData = await topics.getTopicData(tid);
			return await topics.getTopicWithPosts(topicData, `tid:${topicData.tid}:posts`, adminUid, 0, 19, false);
		}

		before(async () => {
			uid = await User.create({ username: 'mergevictim' });
			let result = await topics.post({ uid: uid, cid: categoryObj.cid, title: 'topic 1', content: 'topic 1 OP' });
			topic1Data = result.topicData;
			result = await topics.post({ uid: uid, cid: categoryObj.cid, title: 'topic 2', content: 'topic 2 OP' });
			topic2Data = result.topicData;
			await topics.reply({ uid: uid, content: 'topic 1 reply', tid: topic1Data.tid });
			await topics.reply({ uid: uid, content: 'topic 2 reply', tid: topic2Data.tid });
		});

		it('should error if data is not an array', (done) => {
			socketTopics.merge({ uid: 0 }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error if user does not have privileges', (done) => {
			socketTopics.merge({ uid: 0 }, { tids: [topic2Data.tid, topic1Data.tid] }, (err) => {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should merge 2 topics', async () => {
			await socketTopics.merge({ uid: adminUid }, {
				tids: [topic2Data.tid, topic1Data.tid],
			});

			const [topic1, topic2] = await Promise.all([
				getTopic(topic1Data.tid),
				getTopic(topic2Data.tid),
			]);

			assert.equal(topic1.posts.length, 4);
			assert.equal(topic2.posts.length, 0);
			assert.equal(topic2.deleted, true);

			assert.equal(topic1.posts[0].content, 'topic 1 OP');
			assert.equal(topic1.posts[1].content, 'topic 2 OP');
			assert.equal(topic1.posts[2].content, 'topic 1 reply');
			assert.equal(topic1.posts[3].content, 'topic 2 reply');
			assert.equal(topic1.title, 'topic 1');
		});

		it('should return properly for merged topic', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/topic/${topic2Data.slug}`, { jar: adminJar });
			assert.equal(response.statusCode, 200);
			assert(body);
			assert.deepStrictEqual(body.posts, []);
		});

		it('should merge 2 topics with options mainTid', async () => {
			const topic1Result = await topics.post({ uid: uid, cid: categoryObj.cid, title: 'topic 1', content: 'topic 1 OP' });
			const topic2Result = await topics.post({ uid: uid, cid: categoryObj.cid, title: 'topic 2', content: 'topic 2 OP' });
			await topics.reply({ uid: uid, content: 'topic 1 reply', tid: topic1Result.topicData.tid });
			await topics.reply({ uid: uid, content: 'topic 2 reply', tid: topic2Result.topicData.tid });
			await socketTopics.merge({ uid: adminUid }, {
				tids: [topic2Result.topicData.tid, topic1Result.topicData.tid],
				options: {
					mainTid: topic2Result.topicData.tid,
				},
			});

			const [topic1, topic2] = await Promise.all([
				getTopic(topic1Result.topicData.tid),
				getTopic(topic2Result.topicData.tid),
			]);

			assert.equal(topic1.posts.length, 0);
			assert.equal(topic2.posts.length, 4);
			assert.equal(topic1.deleted, true);

			assert.equal(topic2.posts[0].content, 'topic 2 OP');
			assert.equal(topic2.posts[1].content, 'topic 1 OP');
			assert.equal(topic2.posts[2].content, 'topic 1 reply');
			assert.equal(topic2.posts[3].content, 'topic 2 reply');
			assert.equal(topic2.title, 'topic 2');
		});

		it('should merge 2 topics with options newTopicTitle', async () => {
			const topic1Result = await topics.post({ uid: uid, cid: categoryObj.cid, title: 'topic 1', content: 'topic 1 OP' });
			const topic2Result = await topics.post({ uid: uid, cid: categoryObj.cid, title: 'topic 2', content: 'topic 2 OP' });
			await topics.reply({ uid: uid, content: 'topic 1 reply', tid: topic1Result.topicData.tid });
			await topics.reply({ uid: uid, content: 'topic 2 reply', tid: topic2Result.topicData.tid });
			const mergeTid = await socketTopics.merge({ uid: adminUid }, {
				tids: [topic2Result.topicData.tid, topic1Result.topicData.tid],
				options: {
					newTopicTitle: 'new merge topic',
				},
			});

			const [topic1, topic2, topic3] = await Promise.all([
				getTopic(topic1Result.topicData.tid),
				getTopic(topic2Result.topicData.tid),
				getTopic(mergeTid),
			]);

			assert.equal(topic1.posts.length, 0);
			assert.equal(topic2.posts.length, 0);
			assert.equal(topic3.posts.length, 4);
			assert.equal(topic1.deleted, true);
			assert.equal(topic2.deleted, true);

			assert.equal(topic3.posts[0].content, 'topic 1 OP');
			assert.equal(topic3.posts[1].content, 'topic 2 OP');
			assert.equal(topic3.posts[2].content, 'topic 1 reply');
			assert.equal(topic3.posts[3].content, 'topic 2 reply');
			assert.equal(topic3.title, 'new merge topic');
		});
	});

	describe('sorted topics', () => {
		let category;
		before(async () => {
			category = await categories.create({ name: 'sorted' });
			const topic1Result = await topics.post({ uid: topic.userId, cid: category.cid, title: 'old replied', content: 'topic 1 OP' });
			const topic2Result = await topics.post({ uid: topic.userId, cid: category.cid, title: 'most recent replied', content: 'topic 2 OP' });
			await topics.reply({ uid: topic.userId, content: 'topic 1 reply', tid: topic1Result.topicData.tid });
			await topics.reply({ uid: topic.userId, content: 'topic 2 reply', tid: topic2Result.topicData.tid });
		});

		it('should get sorted topics in category', async () => {
			const filters = ['', 'watched', 'unreplied', 'new'];
			const data = await Promise.all(filters.map(
				async filter => topics.getSortedTopics({
					cids: [category.cid],
					uid: topic.userId,
					start: 0,
					stop: -1,
					filter: filter,
					sort: 'votes',
				})
			));
			assert(data);
			data.forEach((filterTopics) => {
				assert(Array.isArray(filterTopics.topics));
			});
		});

		it('should get topics recent replied first', async () => {
			const data = await topics.getSortedTopics({
				cids: [category.cid],
				uid: topic.userId,
				start: 0,
				stop: -1,
				sort: 'recent',
			});
			assert.strictEqual(data.topics[0].title, 'most recent replied');
			assert.strictEqual(data.topics[1].title, 'old replied');
		});

		it('should get topics recent replied last', async () => {
			const data = await topics.getSortedTopics({
				cids: [category.cid],
				uid: topic.userId,
				start: 0,
				stop: -1,
				sort: 'old',
			});
			assert.strictEqual(data.topics[0].title, 'old replied');
			assert.strictEqual(data.topics[1].title, 'most recent replied');
		});
	});

	describe('scheduled topics', () => {
		let categoryObj;
		let topicData;
		let topic;
		let adminApiOpts;
		let postData;
		const replyData = {
			body: {
				content: 'a reply by guest',
			},
		};

		before(async () => {
			adminApiOpts = {
				jar: adminJar,
				headers: {
					'x-csrf-token': csrf_token,
				},
			};
			categoryObj = await categories.create({
				name: 'Another Test Category',
				description: 'Another test category created by testing script',
			});
			topic = {
				uid: adminUid,
				cid: categoryObj.cid,
				title: 'Scheduled Test Topic Title',
				content: 'The content of scheduled test topic',
				timestamp: new Date(Date.now() + 86400000).getTime(),
			};
		});

		it('should create a scheduled topic as pinned, deleted, included in "topics:scheduled" zset and with a timestamp in future', async () => {
			topicData = (await topics.post(topic)).topicData;
			topicData = await topics.getTopicData(topicData.tid);

			assert(topicData.pinned);
			assert(topicData.deleted);
			assert(topicData.scheduled);
			assert(topicData.timestamp > Date.now());
			const score = await db.sortedSetScore('topics:scheduled', topicData.tid);
			assert(score);
			// should not be in regular category zsets
			const isMember = await db.isMemberOfSortedSets([
				`cid:${categoryObj.cid}:tids`,
				`cid:${categoryObj.cid}:tids:votes`,
				`cid:${categoryObj.cid}:tids:posts`,
			], topicData.tid);
			assert.deepStrictEqual(isMember, [false, false, false]);
		});

		it('should update poster\'s lastposttime with "action time"', async () => {
			// src/user/posts.js:56
			const data = await User.getUsersFields([adminUid], ['lastposttime']);
			assert.notStrictEqual(data[0].lastposttime, topicData.lastposttime);
		});

		it('should not load topic for an unprivileged user', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/topic/${topicData.slug}`);
			assert.strictEqual(response.statusCode, 404);
			assert(body);
		});

		it('should load topic for a privileged user', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/topic/${topicData.slug}`, { jar: adminJar });
			assert.strictEqual(response.statusCode, 200);
			assert(body);
		});

		it('should not be amongst topics of the category for an unprivileged user', async () => {
			const { body } = await request.get(`${nconf.get('url')}/api/category/${categoryObj.slug}`);
			assert.strictEqual(body.topics.filter(topic => topic.tid === topicData.tid).length, 0);
		});

		it('should be amongst topics of the category for a privileged user', async () => {
			const { body } = await request.get(`${nconf.get('url')}/api/category/${categoryObj.slug}`, { jar: adminJar });
			const topic = body.topics.filter(topic => topic.tid === topicData.tid)[0];
			assert.strictEqual(topic && topic.tid, topicData.tid);
		});

		it('should load topic for guests if privilege is given', async () => {
			await privileges.categories.give(['groups:topics:schedule'], categoryObj.cid, 'guests');
			const { response, body } = await request.get(`${nconf.get('url')}/topic/${topicData.slug}`);
			assert.strictEqual(response.statusCode, 200);
			assert(body);
		});

		it('should be amongst topics of the category for guests if privilege is given', async () => {
			const { body } = await request.get(`${nconf.get('url')}/api/category/${categoryObj.slug}`);
			const topic = body.topics.filter(topic => topic.tid === topicData.tid)[0];
			assert.strictEqual(topic && topic.tid, topicData.tid);
		});

		it('should not allow deletion of a scheduled topic', async () => {
			const { response } = await request.delete(`${nconf.get('url')}/api/v3/topics/${topicData.tid}/state`, adminApiOpts);
			assert.strictEqual(response.statusCode, 400);
		});

		it('should not allow to unpin a scheduled topic', async () => {
			const { response } = await request.delete(`${nconf.get('url')}/api/v3/topics/${topicData.tid}/pin`, adminApiOpts);
			assert.strictEqual(response.statusCode, 400);
		});

		it('should not allow to restore a scheduled topic', async () => {
			const { response } = await request.put(`${nconf.get('url')}/api/v3/topics/${topicData.tid}/state`, adminApiOpts);
			assert.strictEqual(response.statusCode, 400);
		});

		it('should not allow unprivileged to reply', async () => {
			await privileges.categories.rescind(['groups:topics:schedule'], categoryObj.cid, 'guests');
			await privileges.categories.give(['groups:topics:reply'], categoryObj.cid, 'guests');
			const { response } = await request.post(`${nconf.get('url')}/api/v3/topics/${topicData.tid}`, replyData);
			assert.strictEqual(response.statusCode, 403);
		});

		it('should allow guests to reply if privilege is given', async () => {
			await privileges.categories.give(['groups:topics:schedule'], categoryObj.cid, 'guests');
			const { body } = await helpers.request('post', `/api/v3/topics/${topicData.tid}`, {
				...replyData,
				jar: request.jar(),
			});
			assert.strictEqual(body.response.content, 'a reply by guest');
			assert.strictEqual(body.response.user.username, '[[global:guest]]');
		});

		it('should have replies with greater timestamp than the scheduled topics itself', async () => {
			const { body } = await request.get(`${nconf.get('url')}/api/topic/${topicData.slug}`);
			postData = body.posts[1];
			assert(postData.timestamp > body.posts[0].timestamp);
		});

		it('should have post edits with greater timestamp than the original', async () => {
			const editData = { ...adminApiOpts, body: { content: 'an edit by the admin' } };
			const result = await request.put(`${nconf.get('url')}/api/v3/posts/${postData.pid}`, editData);
			assert(result.body.response.edited > postData.timestamp);

			const diffsResult = await request.get(`${nconf.get('url')}/api/v3/posts/${postData.pid}/diffs`, adminApiOpts);
			const { revisions } = diffsResult.body.response;
			// diffs are LIFO
			assert(revisions[0].timestamp > revisions[1].timestamp);
		});

		it('should able to reschedule', async () => {
			const newDate = new Date(Date.now() + (5 * 86400000)).getTime();
			const editData = { ...adminApiOpts, body: { ...topic, pid: topicData.mainPid, timestamp: newDate } };
			await request.put(`${nconf.get('url')}/api/v3/posts/${topicData.mainPid}`, editData);

			const editedTopic = await topics.getTopicFields(topicData.tid, ['lastposttime', 'timestamp']);
			const editedPost = await posts.getPostFields(postData.pid, ['timestamp']);
			assert(editedTopic.timestamp === newDate);
			assert(editedPost.timestamp > editedTopic.timestamp);

			const scores = await db.sortedSetsScore([
				'topics:scheduled',
				`uid:${adminUid}:topics`,
				'topics:tid',
				`cid:${topicData.cid}:uid:${adminUid}:tids`,
			], topicData.tid);
			assert(scores.every(publishTime => publishTime === editedTopic.timestamp));
		});

		it('should able to publish a scheduled topic', async () => {
			const topicTimestamp = await topics.getTopicField(topicData.tid, 'timestamp');

			mockdate.set(topicTimestamp);
			await topics.scheduled.handleExpired();

			topicData = await topics.getTopicData(topicData.tid);
			assert(!topicData.pinned);
			assert(!topicData.deleted);
			// Should remove from topics:scheduled upon publishing
			const score = await db.sortedSetScore('topics:scheduled', topicData.tid);
			assert(!score);
		});

		it('should update poster\'s lastposttime after a ST published', async () => {
			const data = await User.getUsersFields([adminUid], ['lastposttime']);
			assert.strictEqual(adminUid, topicData.uid);
			assert.strictEqual(data[0].lastposttime, topicData.lastposttime);
		});

		it('should not be able to schedule a "published" topic', async () => {
			const newDate = new Date(Date.now() + 86400000).getTime();
			const editData = { ...adminApiOpts, body: { ...topic, pid: topicData.mainPid, timestamp: newDate } };
			const { body } = await request.put(`${nconf.get('url')}/api/v3/posts/${topicData.mainPid}`, editData);
			assert.strictEqual(body.response.timestamp, Date.now());
			mockdate.reset();
		});

		it('should allow to purge a scheduled topic', async () => {
			topicData = (await topics.post(topic)).topicData;
			const { response } = await request.delete(`${nconf.get('url')}/api/v3/topics/${topicData.tid}`, adminApiOpts);
			assert.strictEqual(response.statusCode, 200);
		});

		it('should remove from topics:scheduled on purge', async () => {
			const score = await db.sortedSetScore('topics:scheduled', topicData.tid);
			assert(!score);
		});
	});
});

describe('Topics\'', async () => {
	let files;

	before(async () => {
		files = await file.walk(path.resolve(__dirname, './topics'));
	});

	it('subfolder tests', () => {
		files.forEach((filePath) => {
			require(filePath);
		});
	});
});

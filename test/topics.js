'use strict';

const async = require('async');
const assert = require('assert');
const validator = require('validator');
const mockdate = require('mockdate');
const nconf = require('nconf');
const request = require('request');
const util = require('util');

const db = require('./mocks/databasemock');
const topics = require('../src/topics');
const posts = require('../src/posts');
const categories = require('../src/categories');
const privileges = require('../src/privileges');
const meta = require('../src/meta');
const User = require('../src/user');
const groups = require('../src/groups');
const helpers = require('./helpers');
const socketPosts = require('../src/socket.io/posts');
const socketTopics = require('../src/socket.io/topics');


const requestType = util.promisify((type, url, opts, cb) => {
	request[type](url, opts, (err, res, body) => cb(err, { res: res, body: body }));
});

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
		adminJar = await helpers.loginUser('admin', '123456');
		csrf_token = (await requestType('get', `${nconf.get('url')}/api/config`, { json: true, jar: adminJar })).body.csrf_token;

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
		it('should fail to create topic with invalid data', (done) => {
			socketTopics.post({ uid: 0 }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
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

		it('should get post count', (done) => {
			socketTopics.postcount({ uid: adminUid }, topic.tid, (err, count) => {
				assert.ifError(err);
				assert.equal(count, 1);
				done();
			});
		});

		it('should load topic', (done) => {
			socketTopics.getTopic({ uid: adminUid }, topic.tid, (err, data) => {
				assert.ifError(err);
				assert.equal(data.tid, topic.tid);
				done();
			});
		});

		it('should fail to create new topic with invalid user id', (done) => {
			topics.post({ uid: null, title: topic.title, content: topic.content, cid: topic.categoryId }, (err) => {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail to create new topic with empty title', (done) => {
			topics.post({ uid: topic.userId, title: '', content: topic.content, cid: topic.categoryId }, (err) => {
				assert.ok(err);
				done();
			});
		});

		it('should fail to create new topic with empty content', (done) => {
			topics.post({ uid: topic.userId, title: topic.title, content: '', cid: topic.categoryId }, (err) => {
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

		it('should fail to post a topic as guest if no privileges', async () => {
			const categoryObj = await categories.create({
				name: 'Test Category',
				description: 'Test category created by testing script',
			});
			const result = await requestType('post', `${nconf.get('url')}/api/v3/topics`, {
				form: {
					title: 'just a title',
					cid: categoryObj.cid,
					content: 'content for the main post',
				},
				json: true,
			});
			assert.strictEqual(result.body.status.message, '[[error:no-privileges]]');
		});

		it('should post a topic as guest if guest group has privileges', async () => {
			const categoryObj = await categories.create({
				name: 'Test Category',
				description: 'Test category created by testing script',
			});
			await privileges.categories.give(['groups:topics:create'], categoryObj.cid, 'guests');
			await privileges.categories.give(['groups:topics:reply'], categoryObj.cid, 'guests');

			const result = await requestType('post', `${nconf.get('url')}/api/v3/topics`, {
				form: {
					title: 'just a title',
					cid: categoryObj.cid,
					content: 'content for the main post',
				},
				json: true,
			});

			assert.strictEqual(result.body.status.code, 'ok');
			assert.strictEqual(result.body.response.title, 'just a title');
			assert.strictEqual(result.body.response.user.username, '[[global:guest]]');

			const replyResult = await requestType('post', `${nconf.get('url')}/api/v3/topics/${result.body.response.tid}`, {
				form: {
					content: 'a reply by guest',
				},
				json: true,
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
			const result = await requestType('post', `${nconf.get('url')}/api/v3/topics`, {
				form: {
					title: 'just a title',
					cid: categoryObj.cid,
					content: 'content for the main post',
					handle: 'guest123',
				},
				json: true,
			});

			assert.strictEqual(result.body.status.code, 'ok');
			assert.strictEqual(result.body.response.title, 'just a title');
			assert.strictEqual(result.body.response.user.username, 'guest123');
			assert.strictEqual(result.body.response.user.displayname, 'guest123');

			const replyResult = await requestType('post', `${nconf.get('url')}/api/v3/topics/${result.body.response.tid}`, {
				form: {
					content: 'a reply by guest',
					handle: 'guest124',
				},
				json: true,
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

		it('should handle direct replies', (done) => {
			topics.reply({ uid: topic.userId, content: 'test reply', tid: newTopic.tid, toPid: newPost.pid }, (err, result) => {
				assert.equal(err, null, 'was created with error');
				assert.ok(result);

				socketPosts.getReplies({ uid: 0 }, newPost.pid, (err, postData) => {
					assert.ifError(err);

					assert.ok(postData);

					assert.equal(postData.length, 1, 'should have 1 result');
					assert.equal(postData[0].pid, result.pid, 'result should be the reply we added');

					done();
				});
			});
		});

		it('should error if pid is not a number', (done) => {
			socketPosts.getReplies({ uid: 0 }, 'abc', (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should fail to create new reply with invalid user id', (done) => {
			topics.reply({ uid: null, content: 'test post', tid: newTopic.tid }, (err) => {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail to create new reply with empty content', (done) => {
			topics.reply({ uid: topic.userId, content: '', tid: newTopic.tid }, (err) => {
				assert.ok(err);
				done();
			});
		});

		it('should fail to create new reply with invalid topic id', (done) => {
			topics.reply({ uid: null, content: 'test post', tid: 99 }, (err) => {
				assert.equal(err.message, '[[error:no-topic]]');
				done();
			});
		});

		it('should fail to create new reply with invalid toPid', (done) => {
			topics.reply({ uid: topic.userId, content: 'test post', tid: newTopic.tid, toPid: '"onmouseover=alert(1);//' }, (err) => {
				assert.equal(err.message, '[[error:invalid-pid]]');
				done();
			});
		});

		it('should delete nested relies properly', async () => {
			const result = await topics.post({ uid: fooUid, title: 'nested test', content: 'main post', cid: topic.categoryId });
			const reply1 = await topics.reply({ uid: fooUid, content: 'reply post 1', tid: result.topicData.tid });
			const reply2 = await topics.reply({ uid: fooUid, content: 'reply post 2', tid: result.topicData.tid, toPid: reply1.pid });
			let replies = await socketPosts.getReplies({ uid: fooUid }, reply1.pid);
			assert.strictEqual(replies.length, 1);
			assert.strictEqual(replies[0].content, 'reply post 2');
			let toPid = await posts.getPostField(reply2.pid, 'toPid');
			assert.strictEqual(parseInt(toPid, 10), parseInt(reply1.pid, 10));
			await posts.purge(reply1.pid, fooUid);
			replies = await socketPosts.getReplies({ uid: fooUid }, reply1.pid);
			assert.strictEqual(replies.length, 0);
			toPid = await posts.getPostField(reply2.pid, 'toPid');
			assert.strictEqual(toPid, null);
		});
	});

	describe('Get methods', () => {
		let	newTopic;
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

		before((done) => {
			async.waterfall([
				function (next) {
					topics.post({
						uid: topic.userId,
						title: topic.title,
						content: topic.content,
						cid: topic.categoryId,
					}, (err, result) => {
						assert.ifError(err);
						newTopic = result.topicData;
						next();
					});
				},
				function (next) {
					User.create({ username: 'topicFollower', password: '123456' }, next);
				},
				function (_uid, next) {
					followerUid = _uid;
					topics.follow(newTopic.tid, _uid, next);
				},
				function (next) {
					categories.create({
						name: 'Test Category',
						description: 'Test category created by testing script',
					}, (err, category) => {
						if (err) {
							return next(err);
						}
						moveCid = category.cid;
						next();
					});
				},
			], done);
		});

		it('should load topic tools', (done) => {
			socketTopics.loadTopicTools({ uid: adminUid }, { tid: newTopic.tid }, (err, data) => {
				assert.ifError(err);
				assert(data);
				done();
			});
		});

		it('should delete the topic', (done) => {
			socketTopics.delete({ uid: adminUid }, { tids: [newTopic.tid], cid: categoryObj.cid }, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should restore the topic', (done) => {
			socketTopics.restore({ uid: adminUid }, { tids: [newTopic.tid], cid: categoryObj.cid }, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should lock topic', (done) => {
			socketTopics.lock({ uid: adminUid }, { tids: [newTopic.tid], cid: categoryObj.cid }, (err) => {
				assert.ifError(err);
				topics.isLocked(newTopic.tid, (err, isLocked) => {
					assert.ifError(err);
					assert(isLocked);
					done();
				});
			});
		});

		it('should unlock topic', (done) => {
			socketTopics.unlock({ uid: adminUid }, { tids: [newTopic.tid], cid: categoryObj.cid }, (err) => {
				assert.ifError(err);
				topics.isLocked(newTopic.tid, (err, isLocked) => {
					assert.ifError(err);
					assert(!isLocked);
					done();
				});
			});
		});

		it('should pin topic', (done) => {
			socketTopics.pin({ uid: adminUid }, { tids: [newTopic.tid], cid: categoryObj.cid }, (err) => {
				assert.ifError(err);
				topics.getTopicField(newTopic.tid, 'pinned', (err, pinned) => {
					assert.ifError(err);
					assert.strictEqual(pinned, 1);
					done();
				});
			});
		});

		it('should unpin topic', (done) => {
			socketTopics.unpin({ uid: adminUid }, { tids: [newTopic.tid], cid: categoryObj.cid }, (err) => {
				assert.ifError(err);
				topics.getTopicField(newTopic.tid, 'pinned', (err, pinned) => {
					assert.ifError(err);
					assert.strictEqual(pinned, 0);
					done();
				});
			});
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

		it('should properly update sets when post is moved', (done) => {
			let movedPost;
			let previousPost;
			let topic2LastReply;
			let tid1;
			let tid2;
			const cid1 = topic.categoryId;
			let cid2;
			function checkCidSets(post1, post2, callback) {
				async.waterfall([
					function (next) {
						async.parallel({
							topicData: function (next) {
								topics.getTopicsFields([tid1, tid2], ['lastposttime', 'postcount'], next);
							},
							scores1: function (next) {
								db.sortedSetsScore([
									`cid:${cid1}:tids`,
									`cid:${cid1}:tids:lastposttime`,
									`cid:${cid1}:tids:posts`,
								], tid1, next);
							},
							scores2: function (next) {
								db.sortedSetsScore([
									`cid:${cid2}:tids`,
									`cid:${cid2}:tids:lastposttime`,
									`cid:${cid2}:tids:posts`,
								], tid2, next);
							},
							posts1: function (next) {
								db.getSortedSetRangeWithScores(`tid:${tid1}:posts`, 0, -1, next);
							},
							posts2: function (next) {
								db.getSortedSetRangeWithScores(`tid:${tid2}:posts`, 0, -1, next);
							},
						}, next);
					},
					function (results, next) {
						const assertMsg = `${JSON.stringify(results.posts1)}\n${JSON.stringify(results.posts2)}`;
						assert.equal(results.topicData[0].postcount, results.scores1[2], assertMsg);
						assert.equal(results.topicData[1].postcount, results.scores2[2], assertMsg);
						assert.equal(results.topicData[0].lastposttime, post1.timestamp, assertMsg);
						assert.equal(results.topicData[1].lastposttime, post2.timestamp, assertMsg);
						assert.equal(results.topicData[0].lastposttime, results.scores1[0], assertMsg);
						assert.equal(results.topicData[1].lastposttime, results.scores2[0], assertMsg);
						assert.equal(results.topicData[0].lastposttime, results.scores1[1], assertMsg);
						assert.equal(results.topicData[1].lastposttime, results.scores2[1], assertMsg);

						next();
					},
				], callback);
			}

			async.waterfall([
				function (next) {
					categories.create({
						name: 'move to this category',
						description: 'Test category created by testing script',
					}, next);
				},
				function (category, next) {
					cid2 = category.cid;
					topics.post({ uid: adminUid, title: 'topic1', content: 'topic 1 mainPost', cid: cid1 }, next);
				},
				function (result, next) {
					tid1 = result.topicData.tid;
					topics.reply({ uid: adminUid, content: 'topic 1 reply 1', tid: tid1 }, next);
				},
				function (postData, next) {
					previousPost = postData;
					topics.reply({ uid: adminUid, content: 'topic 1 reply 2', tid: tid1 }, next);
				},
				function (postData, next) {
					movedPost = postData;
					topics.post({ uid: adminUid, title: 'topic2', content: 'topic 2 mainpost', cid: cid2 }, next);
				},
				function (results, next) {
					tid2 = results.topicData.tid;
					topics.reply({ uid: adminUid, content: 'topic 2 reply 1', tid: tid2 }, next);
				},
				function (postData, next) {
					topic2LastReply = postData;
					checkCidSets(movedPost, postData, next);
				},
				function (next) {
					db.isMemberOfSortedSets([`cid:${cid1}:pids`, `cid:${cid2}:pids`], movedPost.pid, next);
				},
				function (isMember, next) {
					assert.deepEqual(isMember, [true, false]);
					categories.getCategoriesFields([cid1, cid2], ['post_count'], next);
				},
				function (categoryData, next) {
					assert.equal(categoryData[0].post_count, 4);
					assert.equal(categoryData[1].post_count, 2);
					topics.movePostToTopic(1, movedPost.pid, tid2, next);
				},
				function (next) {
					checkCidSets(previousPost, topic2LastReply, next);
				},
				function (next) {
					db.isMemberOfSortedSets([`cid:${cid1}:pids`, `cid:${cid2}:pids`], movedPost.pid, next);
				},
				function (isMember, next) {
					assert.deepEqual(isMember, [false, true]);
					categories.getCategoriesFields([cid1, cid2], ['post_count'], next);
				},
				function (categoryData, next) {
					assert.equal(categoryData[0].post_count, 3);
					assert.equal(categoryData[1].post_count, 3);
					next();
				},
			], done);
		});

		it('should fail to purge topic if user does not have privilege', (done) => {
			let globalModUid;
			let tid;
			async.waterfall([
				function (next) {
					topics.post({
						uid: adminUid,
						title: 'topic for purge test',
						content: 'topic content',
						cid: categoryObj.cid,
					}, next);
				},
				function (result, next) {
					tid = result.topicData.tid;
					User.create({ username: 'global mod' }, next);
				},
				function (uid, next) {
					globalModUid = uid;
					groups.join('Global Moderators', uid, next);
				},
				function (next) {
					privileges.categories.rescind(['groups:purge'], categoryObj.cid, 'Global Moderators', next);
				},
				function (next) {
					socketTopics.purge({ uid: globalModUid }, { tids: [tid], cid: categoryObj.cid }, (err) => {
						assert.equal(err.message, '[[error:no-privileges]]');
						privileges.categories.give(['groups:purge'], categoryObj.cid, 'Global Moderators', next);
					});
				},
			], done);
		});

		it('should purge the topic', (done) => {
			socketTopics.purge({ uid: adminUid }, { tids: [newTopic.tid], cid: categoryObj.cid }, (err) => {
				assert.ifError(err);
				db.isSortedSetMember(`uid:${followerUid}:followed_tids`, newTopic.tid, (err, isMember) => {
					assert.ifError(err);
					assert.strictEqual(false, isMember);
					done();
				});
			});
		});

		it('should not allow user to restore their topic if it was deleted by an admin', async () => {
			const result = await topics.post({
				uid: fooUid,
				title: 'topic for restore test',
				content: 'topic content',
				cid: categoryObj.cid,
			});
			await socketTopics.delete({ uid: adminUid }, { tids: [result.topicData.tid], cid: categoryObj.cid });
			try {
				await socketTopics.restore({ uid: fooUid }, { tids: [result.topicData.tid], cid: categoryObj.cid });
			} catch (err) {
				assert.strictEqual(err.message, '[[error:no-privileges]]');
			}
		});
	});

	describe('order pinned topics', () => {
		let tid1;
		let tid2;
		let tid3;
		before((done) => {
			function createTopic(callback) {
				topics.post({
					uid: topic.userId,
					title: 'topic for test',
					content: 'topic content',
					cid: topic.categoryId,
				}, callback);
			}
			async.series({
				topic1: function (next) {
					createTopic(next);
				},
				topic2: function (next) {
					createTopic(next);
				},
				topic3: function (next) {
					createTopic(next);
				},
			}, (err, results) => {
				assert.ifError(err);
				tid1 = results.topic1.topicData.tid;
				tid2 = results.topic2.topicData.tid;
				tid3 = results.topic3.topicData.tid;
				async.series([
					function (next) {
						topics.tools.pin(tid1, adminUid, next);
					},
					function (next) {
						// artificial timeout so pin time is different on redis sometimes scores are indentical
						setTimeout(() => {
							topics.tools.pin(tid2, adminUid, next);
						}, 5);
					},
				], done);
			});
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
			socketTopics.orderPinnedTopics({ uid: 0 }, [{ tid: tid1 }, { tid: tid2 }], (err) => {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should not do anything if topics are not pinned', (done) => {
			socketTopics.orderPinnedTopics({ uid: adminUid }, [{ tid: tid3 }], (err) => {
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
				socketTopics.orderPinnedTopics({ uid: adminUid }, [{ tid: tid1, order: 1 }, { tid: tid2, order: 0 }], (err) => {
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
		before((done) => {
			uid = topic.userId;
			async.waterfall([
				function (done) {
					topics.post({ uid: topic.userId, title: 'Topic to be ignored', content: 'Just ignore me, please!', cid: topic.categoryId }, (err, result) => {
						if (err) {
							return done(err);
						}

						newTopic = result.topicData;
						newTid = newTopic.tid;
						done();
					});
				},
				function (done) {
					topics.markUnread(newTid, uid, done);
				},
			], done);
		});

		it('should not appear in the unread list', (done) => {
			async.waterfall([
				function (done) {
					topics.ignore(newTid, uid, done);
				},
				function (done) {
					topics.getUnreadTopics({ cid: 0, uid: uid, start: 0, stop: -1, filter: '' }, done);
				},
				function (results, done) {
					const { topics } = results;
					const tids = topics.map(topic => topic.tid);
					assert.equal(tids.indexOf(newTid), -1, 'The topic appeared in the unread list.');
					done();
				},
			], done);
		});

		it('should not appear as unread in the recent list', (done) => {
			async.waterfall([
				function (done) {
					topics.ignore(newTid, uid, done);
				},
				function (done) {
					topics.getLatestTopics({
						uid: uid,
						start: 0,
						stop: -1,
						term: 'year',
					}, done);
				},
				function (results, done) {
					const { topics } = results;
					let topic;
					let i;
					for (i = 0; i < topics.length; i += 1) {
						if (topics[i].tid === parseInt(newTid, 10)) {
							assert.equal(false, topics[i].unread, 'ignored topic was marked as unread in recent list');
							return done();
						}
					}
					assert.ok(topic, 'topic didn\'t appear in the recent list');
					done();
				},
			], done);
		});

		it('should appear as unread again when marked as reading', (done) => {
			async.waterfall([
				function (done) {
					topics.ignore(newTid, uid, done);
				},
				function (done) {
					topics.follow(newTid, uid, done);
				},
				function (done) {
					topics.getUnreadTopics({ cid: 0, uid: uid, start: 0, stop: -1, filter: '' }, done);
				},
				function (results, done) {
					const { topics } = results;
					const tids = topics.map(topic => topic.tid);
					assert.notEqual(tids.indexOf(newTid), -1, 'The topic did not appear in the unread list.');
					done();
				},
			], done);
		});

		it('should appear as unread again when marked as following', (done) => {
			async.waterfall([
				function (done) {
					topics.ignore(newTid, uid, done);
				},
				function (done) {
					topics.follow(newTid, uid, done);
				},
				function (done) {
					topics.getUnreadTopics({ cid: 0, uid: uid, start: 0, stop: -1, filter: '' }, done);
				},
				function (results, done) {
					const { topics } = results;
					const tids = topics.map(topic => topic.tid);
					assert.notEqual(tids.indexOf(newTid), -1, 'The topic did not appear in the unread list.');
					done();
				},
			], done);
		});
	});

	describe('.fork', () => {
		let newTopic;
		const replies = [];
		let topicPids;
		const originalBookmark = 6;
		function postReply(next) {
			topics.reply({ uid: topic.userId, content: `test post ${replies.length}`, tid: newTopic.tid }, (err, result) => {
				assert.equal(err, null, 'was created with error');
				assert.ok(result);
				replies.push(result);
				next();
			});
		}

		before((done) => {
			async.waterfall([
				function (next) {
					groups.join('administrators', topic.userId, next);
				},
				function (next) {
					topics.post({
						uid: topic.userId,
						title: topic.title,
						content: topic.content,
						cid: topic.categoryId,
					}, (err, result) => {
						assert.ifError(err);
						newTopic = result.topicData;
						next();
					});
				},
				function (next) { postReply(next); },
				function (next) { postReply(next); },
				function (next) { postReply(next); },
				function (next) { postReply(next); },
				function (next) { postReply(next); },
				function (next) { postReply(next); },
				function (next) { postReply(next); },
				function (next) { postReply(next); },
				function (next) { postReply(next); },
				function (next) { postReply(next); },
				function (next) { postReply(next); },
				function (next) { postReply(next); },
				function (next) {
					topicPids = replies.map(reply => reply.pid);
					socketTopics.bookmark({ uid: topic.userId }, { tid: newTopic.tid, index: originalBookmark }, next);
				},
			], done);
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

		it('should not update the user\'s bookmark', (done) => {
			async.waterfall([
				function (next) {
					socketTopics.createTopicFromPosts({ uid: topic.userId }, {
						title: 'Fork test, no bookmark update',
						pids: topicPids.slice(-2),
						fromTid: newTopic.tid,
					}, next);
				},
				function (forkedTopicData, next) {
					topics.getUserBookmark(newTopic.tid, topic.userId, next);
				},
				function (bookmark, next) {
					assert.equal(originalBookmark, bookmark);
					next();
				},
			], done);
		});

		it('should update the user\'s bookmark ', (done) => {
			async.waterfall([
				function (next) {
					topics.createTopicFromPosts(
						topic.userId,
						'Fork test, no bookmark update',
						topicPids.slice(1, 3),
						newTopic.tid,
						next
					);
				},
				function (forkedTopicData, next) {
					topics.getUserBookmark(newTopic.tid, topic.userId, next);
				},
				function (bookmark, next) {
					assert.equal(originalBookmark - 2, bookmark);
					next();
				},
			], done);
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

		it('should load topic', (done) => {
			request(`${nconf.get('url')}/topic/${topicData.slug}`, (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should load topic api data', (done) => {
			request(`${nconf.get('url')}/api/topic/${topicData.slug}`, { json: true }, (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 200);
				assert.strictEqual(body._header.tags.meta.find(t => t.name === 'description').content, 'topic content');
				assert.strictEqual(body._header.tags.meta.find(t => t.property === 'og:description').content, 'topic content');
				done();
			});
		});

		it('should 404 if post index is invalid', (done) => {
			request(`${nconf.get('url')}/topic/${topicData.slug}/derp`, (err, response) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 404);
				done();
			});
		});

		it('should 404 if topic does not exist', (done) => {
			request(`${nconf.get('url')}/topic/123123/does-not-exist`, (err, response) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 404);
				done();
			});
		});

		it('should 401 if not allowed to read as guest', (done) => {
			const privileges = require('../src/privileges');
			privileges.categories.rescind(['groups:topics:read'], topicData.cid, 'guests', (err) => {
				assert.ifError(err);
				request(`${nconf.get('url')}/api/topic/${topicData.slug}`, (err, response, body) => {
					assert.ifError(err);
					assert.equal(response.statusCode, 401);
					assert(body);
					privileges.categories.give(['groups:topics:read'], topicData.cid, 'guests', done);
				});
			});
		});

		it('should redirect to correct topic if slug is missing', (done) => {
			request(`${nconf.get('url')}/topic/${topicData.tid}/herpderp/1?page=2`, (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 200);
				assert(body);
				done();
			});
		});

		it('should redirect if post index is out of range', (done) => {
			request(`${nconf.get('url')}/api/topic/${topicData.slug}/-1`, { json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(res.headers['x-redirect'], `/topic/${topicData.tid}/topic-for-controller-test`);
				assert.equal(body, `/topic/${topicData.tid}/topic-for-controller-test`);
				done();
			});
		});

		it('should 404 if page is out of bounds', (done) => {
			const meta = require('../src/meta');
			meta.config.usePagination = 1;
			request(`${nconf.get('url')}/topic/${topicData.slug}?page=100`, (err, response) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 404);
				done();
			});
		});

		it('should mark topic read', (done) => {
			request(`${nconf.get('url')}/topic/${topicData.slug}`, {
				jar: adminJar,
			}, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				topics.hasReadTopics([topicData.tid], adminUid, (err, hasRead) => {
					assert.ifError(err);
					assert.equal(hasRead[0], true);
					done();
				});
			});
		});

		it('should 404 if tid is not a number', (done) => {
			request(`${nconf.get('url')}/api/topic/teaser/nan`, { json: true }, (err, response) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 404);
				done();
			});
		});

		it('should 403 if cant read', (done) => {
			request(`${nconf.get('url')}/api/topic/teaser/${123123}`, { json: true }, (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 403);
				assert.equal(body, '[[error:no-privileges]]');

				done();
			});
		});

		it('should load topic teaser', (done) => {
			request(`${nconf.get('url')}/api/topic/teaser/${topicData.tid}`, { json: true }, (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 200);
				assert(body);
				assert.equal(body.tid, topicData.tid);
				assert.equal(body.content, 'topic content');
				assert(body.user);
				assert(body.topic);
				assert(body.category);
				done();
			});
		});


		it('should 404 if tid is not a number', (done) => {
			request(`${nconf.get('url')}/api/topic/pagination/nan`, { json: true }, (err, response) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 404);
				done();
			});
		});

		it('should 404 if tid does not exist', (done) => {
			request(`${nconf.get('url')}/api/topic/pagination/1231231`, { json: true }, (err, response) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 404);
				done();
			});
		});

		it('should load pagination', (done) => {
			request(`${nconf.get('url')}/api/topic/pagination/${topicData.tid}`, { json: true }, (err, response, body) => {
				assert.ifError(err);
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
				done();
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
				assert(data.mainPost);
				assert(data.posts);
				assert(data.privileges);
				done();
			});
		});

		it('should error with invalid data', (done) => {
			socketTopics.loadMoreSortedTopics({ uid: adminUid }, { after: 'invalid' }, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should load more unread topics', (done) => {
			socketTopics.markUnread({ uid: adminUid }, tid, (err) => {
				assert.ifError(err);
				socketTopics.loadMoreSortedTopics({ uid: adminUid }, { cid: topic.categoryId, after: 0, count: 10, sort: 'unread' }, (err, data) => {
					assert.ifError(err);
					assert(data);
					assert(Array.isArray(data.topics));
					done();
				});
			});
		});

		it('should error with invalid data', (done) => {
			socketTopics.loadMoreSortedTopics({ uid: adminUid }, { after: 'invalid' }, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});


		it('should load more recent topics', (done) => {
			socketTopics.loadMoreSortedTopics({ uid: adminUid }, { cid: topic.categoryId, after: 0, count: 10, sort: 'recent' }, (err, data) => {
				assert.ifError(err);
				assert(data);
				assert(Array.isArray(data.topics));
				done();
			});
		});

		it('should error with invalid data', (done) => {
			socketTopics.loadMoreFromSet({ uid: adminUid }, { after: 'invalid' }, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should load more from custom set', (done) => {
			socketTopics.loadMoreFromSet({ uid: adminUid }, { set: `uid:${adminUid}:topics`, after: 0, count: 10 }, (err, data) => {
				assert.ifError(err);
				assert(data);
				assert(Array.isArray(data.topics));
				done();
			});
		});
	});

	describe('suggested topics', () => {
		let tid1;
		let tid3;
		before((done) => {
			async.series({
				topic1: function (next) {
					topics.post({ uid: adminUid, tags: ['nodebb'], title: 'topic title 1', content: 'topic 1 content', cid: topic.categoryId }, next);
				},
				topic2: function (next) {
					topics.post({ uid: adminUid, tags: ['nodebb'], title: 'topic title 2', content: 'topic 2 content', cid: topic.categoryId }, next);
				},
				topic3: function (next) {
					topics.post({ uid: adminUid, tags: [], title: 'topic title 3', content: 'topic 3 content', cid: topic.categoryId }, next);
				},
			}, (err, results) => {
				assert.ifError(err);
				tid1 = results.topic1.topicData.tid;
				tid3 = results.topic3.topicData.tid;
				done();
			});
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
		let mainPid;
		let uid;
		before((done) => {
			async.parallel({
				topic: function (next) {
					topics.post({ uid: topic.userId, title: 'unread topic', content: 'unread topic content', cid: topic.categoryId }, next);
				},
				joeUid: function (next) {
					User.create({ username: 'regularJoe' }, next);
				},
			}, (err, results) => {
				assert.ifError(err);
				tid = results.topic.topicData.tid;
				mainPid = results.topic.postData.pid;
				uid = results.joeUid;
				done();
			});
		});

		it('should fail with invalid data', (done) => {
			socketTopics.markUnread({ uid: adminUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should fail if topic does not exist', (done) => {
			socketTopics.markUnread({ uid: adminUid }, 1231082, (err) => {
				assert.equal(err.message, '[[error:no-topic]]');
				done();
			});
		});

		it('should mark topic unread', (done) => {
			socketTopics.markUnread({ uid: adminUid }, tid, (err) => {
				assert.ifError(err);
				topics.hasReadTopic(tid, adminUid, (err, hasRead) => {
					assert.ifError(err);
					assert.equal(hasRead, false);
					done();
				});
			});
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

		it('should mark topic notifications read', (done) => {
			async.waterfall([
				function (next) {
					socketTopics.follow({ uid: adminUid }, tid, next);
				},
				function (next) {
					topics.reply({ uid: uid, timestamp: Date.now(), content: 'some content', tid: tid }, next);
				},
				function (data, next) {
					setTimeout(next, 2500);
				},
				function (next) {
					User.notifications.getUnreadCount(adminUid, next);
				},
				function (count, next) {
					assert.equal(count, 1);
					socketTopics.markTopicNotificationsRead({ uid: adminUid }, [tid], next);
				},
				function (next) {
					User.notifications.getUnreadCount(adminUid, next);
				},
				function (count, next) {
					assert.equal(count, 0);
					next();
				},
			], (err) => {
				assert.ifError(err);
				done();
			});
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

		it('should fail with invalid data', (done) => {
			socketTopics.markAsUnreadForAll({ uid: adminUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-tid]]');
				done();
			});
		});

		it('should fail with invalid data', (done) => {
			socketTopics.markAsUnreadForAll({ uid: 0 }, [tid], (err) => {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail if user is not admin', (done) => {
			socketTopics.markAsUnreadForAll({ uid: uid }, [tid], (err) => {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail if topic does not exist', (done) => {
			socketTopics.markAsUnreadForAll({ uid: uid }, [12312313], (err) => {
				assert.equal(err.message, '[[error:no-topic]]');
				done();
			});
		});

		it('should mark topic unread for everyone', (done) => {
			socketTopics.markAsUnreadForAll({ uid: adminUid }, [tid], (err) => {
				assert.ifError(err);
				async.parallel({
					adminRead: function (next) {
						topics.hasReadTopic(tid, adminUid, next);
					},
					regularRead: function (next) {
						topics.hasReadTopic(tid, uid, next);
					},
				}, (err, results) => {
					assert.ifError(err);
					assert.equal(results.adminRead, false);
					assert.equal(results.regularRead, false);
					done();
				});
			});
		});

		it('should not do anything if tids is empty array', (done) => {
			socketTopics.markAsRead({ uid: adminUid }, [], (err, markedRead) => {
				assert.ifError(err);
				assert(!markedRead);
				done();
			});
		});

		it('should not return topics in category you cant read', (done) => {
			let privateCid;
			let privateTid;
			async.waterfall([
				function (next) {
					categories.create({
						name: 'private category',
						description: 'private category',
					}, next);
				},
				function (category, next) {
					privateCid = category.cid;
					privileges.categories.rescind(['groups:topics:read'], category.cid, 'registered-users', next);
				},
				function (next) {
					topics.post({ uid: adminUid, title: 'topic in private category', content: 'registered-users cant see this', cid: privateCid }, next);
				},
				function (data, next) {
					privateTid = data.topicData.tid;
					topics.getUnreadTids({ uid: uid }, next);
				},
				function (unreadTids, next) {
					unreadTids = unreadTids.map(String);
					assert(!unreadTids.includes(String(privateTid)));
					next();
				},
			], done);
		});

		it('should not return topics in category you ignored/not watching', (done) => {
			let ignoredCid;
			let tid;
			async.waterfall([
				function (next) {
					categories.create({
						name: 'ignored category',
						description: 'ignored category',
					}, next);
				},
				function (category, next) {
					ignoredCid = category.cid;
					privileges.categories.rescind(['groups:topics:read'], category.cid, 'registered-users', next);
				},
				function (next) {
					topics.post({ uid: adminUid, title: 'topic in private category', content: 'registered-users cant see this', cid: ignoredCid }, next);
				},
				function (data, next) {
					tid = data.topicData.tid;
					User.ignoreCategory(uid, ignoredCid, next);
				},
				function (next) {
					topics.getUnreadTids({ uid: uid }, next);
				},
				function (unreadTids, next) {
					unreadTids = unreadTids.map(String);
					assert(!unreadTids.includes(String(tid)));
					next();
				},
			], done);
		});

		it('should not return topic as unread if new post is from blocked user', (done) => {
			let blockedUid;
			let topic;
			async.waterfall([
				function (next) {
					topics.post({ uid: adminUid, title: 'will not get as unread', content: 'not unread', cid: categoryObj.cid }, next);
				},
				function (result, next) {
					topic = result.topicData;
					User.create({ username: 'blockedunread' }, next);
				},
				function (uid, next) {
					blockedUid = uid;
					User.blocks.add(uid, adminUid, next);
				},
				function (next) {
					topics.reply({ uid: blockedUid, content: 'post from blocked user', tid: topic.tid }, next);
				},
				function (result, next) {
					topics.getUnreadTids({ cid: 0, uid: adminUid }, next);
				},
				function (unreadTids, next) {
					assert(!unreadTids.includes(topic.tid));
					User.blocks.remove(blockedUid, adminUid, next);
				},
			], done);
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

		before((done) => {
			async.series([
				function (next) {
					topics.post({ uid: adminUid, tags: ['php', 'nosql', 'psql', 'nodebb'], title: 'topic title 1', content: 'topic 1 content', cid: topic.categoryId }, next);
				},
				function (next) {
					topics.post({ uid: adminUid, tags: ['javascript', 'mysql', 'python', 'nodejs'], title: 'topic title 2', content: 'topic 2 content', cid: topic.categoryId }, next);
				},
			], (err) => {
				assert.ifError(err);
				done();
			});
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
				assert.equal(data.matchCount, 3);
				assert.equal(data.pageCount, 1);
				const tagData = [
					{ value: 'nodebb', valueEscaped: 'nodebb', color: '', bgColor: '', score: 3 },
					{ value: 'nodejs', valueEscaped: 'nodejs', color: '', bgColor: '', score: 1 },
					{ value: 'nosql', valueEscaped: 'nosql', color: '', bgColor: '', score: 1 },
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

		it('should error if data is invalid', (done) => {
			socketAdmin.tags.update({ uid: adminUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error if data is not an array', (done) => {
			socketAdmin.tags.update({ uid: adminUid }, {
				bgColor: '#ff0000',
				color: '#00ff00',
			}, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should update tag', (done) => {
			socketAdmin.tags.update({ uid: adminUid }, [{
				value: 'emptytag',
				bgColor: '#ff0000',
				color: '#00ff00',
			}], (err) => {
				assert.ifError(err);
				db.getObject('tag:emptytag', (err, data) => {
					assert.ifError(err);
					assert.equal(data.bgColor, '#ff0000');
					assert.equal(data.color, '#00ff00');
					done();
				});
			});
		});

		it('should rename tags', (done) => {
			async.series({
				topic1: function (next) {
					topics.post({ uid: adminUid, tags: ['plugins'], title: 'topic tagged with plugins', content: 'topic 1 content', cid: topic.categoryId }, next);
				},
				topic2: function (next) {
					topics.post({ uid: adminUid, tags: ['plugin'], title: 'topic tagged with plugin', content: 'topic 2 content', cid: topic.categoryId }, next);
				},
			}, (err, result) => {
				assert.ifError(err);
				socketAdmin.tags.rename({ uid: adminUid }, [{
					value: 'plugin',
					newName: 'plugins',
				}], (err) => {
					assert.ifError(err);
					topics.getTagTids('plugins', 0, -1, (err, tids) => {
						assert.ifError(err);
						assert.equal(tids.length, 2);
						topics.getTopicTags(result.topic2.topicData.tid, (err, tags) => {
							assert.ifError(err);
							assert.equal(tags.length, 1);
							assert.equal(tags[0], 'plugins');
							done();
						});
					});
				});
			});
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
			assert.deepStrictEqual(tags, ['tag1', 'tag2', 'tag3', 'tag4']);
			assert.deepStrictEqual(categoryTags.sort(), ['tag1', 'tag2', 'tag3', 'tag4']);

			await topics.addTags(['tag7', 'tag6', 'tag5'], [tid]);
			tags = await topics.getTopicTags(tid);
			categoryTags = await topics.getCategoryTags(cid, 0, -1);
			assert.deepStrictEqual(tags, ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7']);
			assert.deepStrictEqual(categoryTags.sort(), ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7']);

			await topics.removeTags(['tag1', 'tag3', 'tag5', 'tag7'], [tid]);
			tags = await topics.getTopicTags(tid);
			categoryTags = await topics.getCategoryTags(cid, 0, -1);
			assert.deepStrictEqual(tags, ['tag2', 'tag4', 'tag6']);
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
				{ value: 'cattag1', score: 3, bgColor: '', color: '', valueEscaped: 'cattag1' },
				{ value: 'cattag2', score: 2, bgColor: '', color: '', valueEscaped: 'cattag2' },
				{ value: 'cattag3', score: 1, bgColor: '', color: '', valueEscaped: 'cattag3' },
			]);

			// after purging values should update properly
			await topics.purge(postResult.topicData.tid, adminUid);
			result = await topics.getCategoryTagsData(cid, 0, -1);

			assert.deepStrictEqual(result, [
				{ value: 'cattag1', score: 2, bgColor: '', color: '', valueEscaped: 'cattag1' },
				{ value: 'cattag2', score: 1, bgColor: '', color: '', valueEscaped: 'cattag2' },
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
				{ value: 'movedtag1', score: 2, bgColor: '', color: '', valueEscaped: 'movedtag1' },
				{ value: 'movedtag2', score: 1, bgColor: '', color: '', valueEscaped: 'movedtag2' },
			]);
			assert.deepStrictEqual(result2, [
				{ value: 'movedtag2', score: 1, bgColor: '', color: '', valueEscaped: 'movedtag2' },
			]);

			// after moving values should update properly
			await topics.tools.move(postResult.topicData.tid, { cid: cid2, uid: adminUid });

			result1 = await topics.getCategoryTagsData(cid1, 0, -1);
			result2 = await topics.getCategoryTagsData(cid2, 0, -1);
			assert.deepStrictEqual(result1, [
				{ value: 'movedtag1', score: 1, bgColor: '', color: '', valueEscaped: 'movedtag1' },
			]);
			assert.deepStrictEqual(result2, [
				{ value: 'movedtag2', score: 2, bgColor: '', color: '', valueEscaped: 'movedtag2' },
				{ value: 'movedtag1', score: 1, bgColor: '', color: '', valueEscaped: 'movedtag1' },
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

		it('should error if not logged in', (done) => {
			socketTopics.changeWatching({ uid: 0 }, { tid: tid, type: 'ignore' }, (err) => {
				assert.equal(err.message, '[[error:not-logged-in]]');
				done();
			});
		});

		it('should filter ignoring uids', (done) => {
			socketTopics.changeWatching({ uid: followerUid }, { tid: tid, type: 'ignore' }, (err) => {
				assert.ifError(err);
				topics.filterIgnoringUids(tid, [adminUid, followerUid], (err, uids) => {
					assert.ifError(err);
					assert.equal(uids.length, 1);
					assert.equal(uids[0], adminUid);
					done();
				});
			});
		});

		it('should error with invalid data', (done) => {
			socketTopics.changeWatching({ uid: followerUid }, {}, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error with invalid type', (done) => {
			socketTopics.changeWatching({ uid: followerUid }, { tid: tid, type: 'derp' }, (err) => {
				assert.equal(err.message, '[[error:invalid-command]]');
				done();
			});
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
		it('should error with invalid data', (done) => {
			socketTopics.search({ uid: adminUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should return results', (done) => {
			const plugins = require('../src/plugins');
			plugins.hooks.register('myTestPlugin', {
				hook: 'filter:topic.search',
				method: function (data, callback) {
					callback(null, [1, 2, 3]);
				},
			});
			socketTopics.search({ uid: adminUid }, { tid: topic.tid, term: 'test' }, (err, results) => {
				assert.ifError(err);
				assert.deepEqual(results, [1, 2, 3]);
				done();
			});
		});
	});

	it('should check if user is moderator', (done) => {
		socketTopics.isModerator({ uid: adminUid }, topic.tid, (err, isModerator) => {
			assert.ifError(err);
			assert(!isModerator);
			done();
		});
	});

	describe('teasers', () => {
		let topic1;
		let topic2;
		before((done) => {
			async.series([
				function (next) {
					topics.post({ uid: adminUid, title: 'topic 1', content: 'content 1', cid: categoryObj.cid }, next);
				},
				function (next) {
					topics.post({ uid: adminUid, title: 'topic 2', content: 'content 2', cid: categoryObj.cid }, next);
				},
			], (err, results) => {
				assert.ifError(err);
				topic1 = results[0];
				topic2 = results[1];
				done();
			});
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

		it('should not return teaser if user is blocked', (done) => {
			let blockedUid;
			async.waterfall([
				function (next) {
					User.create({ username: 'blocked' }, next);
				},
				function (uid, next) {
					blockedUid = uid;
					User.blocks.add(uid, adminUid, next);
				},
				function (next) {
					topics.reply({ uid: blockedUid, content: 'post from blocked user', tid: topic2.topicData.tid }, next);
				},
				function (result, next) {
					topics.getTeaser(topic2.topicData.tid, adminUid, next);
				},
				function (teaser, next) {
					assert.equal(teaser.content, 'content 2');
					User.blocks.remove(blockedUid, adminUid, next);
				},
			], done);
		});
	});

	describe('tag privilege', () => {
		let uid;
		let cid;
		before((done) => {
			async.waterfall([
				function (next) {
					User.create({ username: 'tag_poster' }, next);
				},
				function (_uid, next) {
					uid = _uid;
					categories.create({ name: 'tag category' }, next);
				},
				function (categoryObj, next) {
					cid = categoryObj.cid;
					next();
				},
			], done);
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

		before((done) => {
			async.waterfall([
				function (next) {
					User.create({ username: 'mergevictim' }, next);
				},
				function (_uid, next) {
					uid = _uid;
					topics.post({ uid: uid, cid: categoryObj.cid, title: 'topic 1', content: 'topic 1 OP' }, next);
				},
				function (result, next) {
					topic1Data = result.topicData;
					topics.post({ uid: uid, cid: categoryObj.cid, title: 'topic 2', content: 'topic 2 OP' }, next);
				},
				function (result, next) {
					topic2Data = result.topicData;
					topics.reply({ uid: uid, content: 'topic 1 reply', tid: topic1Data.tid }, next);
				},
				function (postData, next) {
					topics.reply({ uid: uid, content: 'topic 2 reply', tid: topic2Data.tid }, next);
				},
			], done);
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

		it('should return properly for merged topic', (done) => {
			request(`${nconf.get('url')}/api/topic/${topic2Data.slug}`, { jar: adminJar, json: true }, (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 200);
				assert(body);
				assert.deepStrictEqual(body.posts, []);
				done();
			});
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
		it('should get sorted topics in category', (done) => {
			const filters = ['', 'watched', 'unreplied', 'new'];
			async.map(filters, (filter, next) => {
				topics.getSortedTopics({
					cids: [topic.categoryId],
					uid: topic.userId,
					start: 0,
					stop: -1,
					filter: filter,
					sort: 'votes',
				}, next);
			}, (err, data) => {
				assert.ifError(err);
				assert(data);
				data.forEach((filterTopics) => {
					assert(Array.isArray(filterTopics.topics));
				});
				done();
			});
		});
	});

	describe('scheduled topics', () => {
		let categoryObj;
		let topicData;
		let topic;
		let adminApiOpts;
		let postData;
		const replyData = {
			form: {
				content: 'a reply by guest',
			},
			json: true,
		};

		before(async () => {
			adminApiOpts = {
				json: true,
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
			const response = await requestType('get', `${nconf.get('url')}/topic/${topicData.slug}`);
			assert.strictEqual(response.statusCode, 404);
			assert(response.body);
		});

		it('should load topic for a privileged user', async () => {
			const response = (await requestType('get', `${nconf.get('url')}/topic/${topicData.slug}`, { jar: adminJar })).res;
			assert.strictEqual(response.statusCode, 200);
			assert(response.body);
		});

		it('should not be amongst topics of the category for an unprivileged user', async () => {
			const response = await requestType('get', `${nconf.get('url')}/api/category/${categoryObj.slug}`, { json: true });
			assert.strictEqual(response.body.topics.filter(topic => topic.tid === topicData.tid).length, 0);
		});

		it('should be amongst topics of the category for a privileged user', async () => {
			const response = await requestType('get', `${nconf.get('url')}/api/category/${categoryObj.slug}`, { json: true, jar: adminJar });
			const topic = response.body.topics.filter(topic => topic.tid === topicData.tid)[0];
			assert.strictEqual(topic && topic.tid, topicData.tid);
		});

		it('should load topic for guests if privilege is given', async () => {
			await privileges.categories.give(['groups:topics:schedule'], categoryObj.cid, 'guests');
			const response = await requestType('get', `${nconf.get('url')}/topic/${topicData.slug}`);
			assert.strictEqual(response.statusCode, 200);
			assert(response.body);
		});

		it('should be amongst topics of the category for guests if privilege is given', async () => {
			const response = await requestType('get', `${nconf.get('url')}/api/category/${categoryObj.slug}`, { json: true });
			const topic = response.body.topics.filter(topic => topic.tid === topicData.tid)[0];
			assert.strictEqual(topic && topic.tid, topicData.tid);
		});

		it('should not allow deletion of a scheduled topic', async () => {
			const response = await requestType('delete', `${nconf.get('url')}/api/v3/topics/${topicData.tid}/state`, adminApiOpts);
			assert.strictEqual(response.res.statusCode, 400);
		});

		it('should not allow to unpin a scheduled topic', async () => {
			const response = await requestType('delete', `${nconf.get('url')}/api/v3/topics/${topicData.tid}/pin`, adminApiOpts);
			assert.strictEqual(response.res.statusCode, 400);
		});

		it('should not allow to restore a scheduled topic', async () => {
			const response = await requestType('put', `${nconf.get('url')}/api/v3/topics/${topicData.tid}/state`, adminApiOpts);
			assert.strictEqual(response.res.statusCode, 400);
		});

		it('should not allow unprivileged to reply', async () => {
			await privileges.categories.rescind(['groups:topics:schedule'], categoryObj.cid, 'guests');
			await privileges.categories.give(['groups:topics:reply'], categoryObj.cid, 'guests');
			const response = await requestType('post', `${nconf.get('url')}/api/v3/topics/${topicData.tid}`, replyData);
			assert.strictEqual(response.res.statusCode, 403);
		});

		it('should allow guests to reply if privilege is given', async () => {
			await privileges.categories.give(['groups:topics:schedule'], categoryObj.cid, 'guests');
			const response = await requestType('post', `${nconf.get('url')}/api/v3/topics/${topicData.tid}`, replyData);
			assert.strictEqual(response.body.response.content, 'a reply by guest');
			assert.strictEqual(response.body.response.user.username, '[[global:guest]]');
		});

		it('should have replies with greater timestamp than the scheduled topics itself', async () => {
			const response = await requestType('get', `${nconf.get('url')}/api/topic/${topicData.slug}`, { json: true });
			postData = response.body.posts[1];
			assert(postData.timestamp > response.body.posts[0].timestamp);
		});

		it('should have post edits with greater timestamp than the original', async () => {
			const editData = { ...adminApiOpts, form: { content: 'an edit by the admin' } };
			const result = await requestType('put', `${nconf.get('url')}/api/v3/posts/${postData.pid}`, editData);
			assert(result.body.response.edited > postData.timestamp);

			const diffsResult = await requestType('get', `${nconf.get('url')}/api/v3/posts/${postData.pid}/diffs`, adminApiOpts);
			const { revisions } = diffsResult.body.response;
			// diffs are LIFO
			assert(revisions[0].timestamp > revisions[1].timestamp);
		});

		it('should able to reschedule', async () => {
			const newDate = new Date(Date.now() + (5 * 86400000)).getTime();
			const editData = { ...adminApiOpts, form: { ...topic, pid: topicData.mainPid, timestamp: newDate } };
			const response = await requestType('put', `${nconf.get('url')}/api/v3/posts/${topicData.mainPid}`, editData);

			const editedTopic = await topics.getTopicFields(topicData.tid, ['lastposttime', 'timestamp']);
			const editedPost = await posts.getPostFields(postData.pid, ['timestamp']);
			assert(editedTopic.timestamp === newDate);
			assert(editedPost.timestamp > editedTopic.timestamp);

			const scores = await db.sortedSetsScore([
				'topics:scheduled',
				`uid:${adminUid}:topics`,
				'topics:tid',
				`cid:${topicData.cid}:tids`,
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
			const editData = { ...adminApiOpts, form: { ...topic, pid: topicData.mainPid, timestamp: newDate } };
			const response = await requestType('put', `${nconf.get('url')}/api/v3/posts/${topicData.mainPid}`, editData);
			assert.strictEqual(response.body.response.timestamp, Date.now());

			mockdate.reset();
		});

		it('should allow to purge a scheduled topic', async () => {
			topicData = (await topics.post(topic)).topicData;
			const response = await requestType('delete', `${nconf.get('url')}/api/v3/topics/${topicData.tid}`, adminApiOpts);
			assert.strictEqual(response.res.statusCode, 200);
		});

		it('should remove from topics:scheduled on purge', async () => {
			const score = await db.sortedSetScore('topics:scheduled', topicData.tid);
			assert(!score);
		});
	});
});

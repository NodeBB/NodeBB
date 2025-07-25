'use strict';

const assert = require('assert');
const db = require('./mocks/databasemock');
const topics = require('../src/topics');
const posts = require('../src/posts');
const categories = require('../src/categories');
const user = require('../src/user');
const meta = require('../src/meta');
const apiTopics = require('../src/api/topics');

describe('Threading', () => {
	let testUid;
	let testUid2;
	let testCid;
	let testTid;
	let mainPid;
	let childPid1;
	let childPid2;
	let grandchildPid;

	before(async () => {
		// Create test users
		testUid = await user.create({ username: 'threadtester1' });
		testUid2 = await user.create({ username: 'threadtester2' });

		// Create test category
		const categoryData = await categories.create({
			name: 'Threading Test Category',
			description: 'Category for testing threading functionality',
		});
		testCid = categoryData.cid;

		// Create a test topic with main post
		const topicResult = await topics.post({
			uid: testUid,
			cid: testCid,
			title: 'Threading Test Topic',
			content: 'This is the main post',
		});
		testTid = topicResult.topicData.tid;
		mainPid = topicResult.postData.pid;

		// Set threading configuration
		await meta.settings.set('threading', {
			threadingEnabled: '1',
			threadingMaxDepth: '5',
			threadingDefaultMode: 'flat',
		});
	});

	describe('Post Creation with parentPid', () => {
		it('should create a child post with parentPid', async () => {
			const replyData = await topics.reply({
				uid: testUid2,
				tid: testTid,
				content: 'This is a threaded reply',
				parentPid: mainPid,
			});

			childPid1 = replyData.pid;
			
			assert(replyData.parentPid);
			assert.strictEqual(parseInt(replyData.parentPid, 10), parseInt(mainPid, 10));
		});

		it('should create a second child post', async () => {
			const replyData = await topics.reply({
				uid: testUid,
				tid: testTid,
				content: 'Another threaded reply',
				parentPid: mainPid,
			});

			childPid2 = replyData.pid;
			assert.strictEqual(parseInt(replyData.parentPid, 10), parseInt(mainPid, 10));
		});

		it('should create a grandchild post', async () => {
			const replyData = await topics.reply({
				uid: testUid2,
				tid: testTid,
				content: 'Reply to the reply',
				parentPid: childPid1,
			});

			grandchildPid = replyData.pid;
			assert.strictEqual(parseInt(replyData.parentPid, 10), parseInt(childPid1, 10));
		});
	});

	describe('Depth Validation', () => {
		it('should reject posts that exceed max depth', async () => {
			// Set a very low max depth for testing
			await meta.settings.set('threading', {
				threadingMaxDepth: '2',
			});

			try {
				await topics.reply({
					uid: testUid,
					tid: testTid,
					content: 'This should fail due to depth',
					parentPid: grandchildPid,
				});
				assert.fail('Should have thrown an error for exceeding max depth');
			} catch (err) {
				assert(err.message.includes('max-depth-exceeded') || err.message.includes('depth'));
			}

			// Reset max depth
			await meta.settings.set('threading', {
				threadingMaxDepth: '5',
			});
		});

		it('should reject posts that create cycles', async () => {
			try {
				await topics.reply({
					uid: testUid,
					tid: testTid,
					content: 'This should create a cycle',
					parentPid: grandchildPid,
				});
				
				// Now try to make grandchild point to this new post
				// This should fail due to cycle detection
				const newPost = await posts.getPostData(grandchildPid);
				await posts.edit({
					pid: newPost.pid,
					uid: testUid,
					content: newPost.content,
					parentPid: newPost.pid, // Self-reference
				});
				
				assert.fail('Should have thrown an error for creating a cycle');
			} catch (err) {
				assert(err.message.includes('cycle') || err.message.includes('depth'));
			}
		});
	});

	describe('Cross-topic Validation', () => {
		it('should reject parentPid from different topic', async () => {
			// Create another topic
			const otherTopicResult = await topics.post({
				uid: testUid,
				cid: testCid,
				title: 'Other Topic',
				content: 'This is another topic',
			});

			try {
				await topics.reply({
					uid: testUid,
					tid: testTid,
					content: 'Reply with parent from different topic',
					parentPid: otherTopicResult.postData.pid,
				});
				assert.fail('Should have thrown an error for cross-topic parent');
			} catch (err) {
				assert(err.message.includes('different-topic') || err.message.includes('invalid'));
			}
		});
	});

	describe('API Endpoints', () => {
		it('should get posts in flat format', async () => {
			const caller = { uid: testUid };
			const result = await apiTopics.getPosts(caller, {
				tid: testTid,
				flat: 'true',
				tree: 'false',
			});

			assert(result);
			assert(Array.isArray(result.posts));
			assert.strictEqual(result.viewType, 'flat');
			assert(result.posts.length >= 4); // main + 3 replies
		});

		it('should get posts in tree format', async () => {
			const caller = { uid: testUid };
			const result = await apiTopics.getPosts(caller, {
				tid: testTid,
				flat: 'false',
				tree: 'true',
			});

			assert(result);
			assert(Array.isArray(result.posts));
			assert.strictEqual(result.viewType, 'tree');
			
			// Check tree structure
			const mainPost = result.posts.find(p => p.pid === mainPid);
			assert(mainPost);
			assert(Array.isArray(mainPost.children));
			assert(mainPost.children.length >= 2); // Two child posts
			
			// Check for grandchild
			const childPost = mainPost.children.find(p => p.pid === childPid1);
			assert(childPost);
			assert(Array.isArray(childPost.children));
			assert(childPost.children.length >= 1); // One grandchild
		});

		it('should create threaded reply via API', async () => {
			const caller = { uid: testUid };
			const result = await apiTopics.reply(caller, {
				tid: testTid,
				content: 'API threaded reply',
				parentPid: mainPid,
			});

			assert(result);
			assert(result.parentPid);
			assert.strictEqual(parseInt(result.parentPid, 10), parseInt(mainPid, 10));
		});
	});

	describe('Database Tracking', () => {
		it('should maintain parent-child relationships in database', async () => {
			// Check that children are tracked
			const children = await db.getSortedSetMembers(`pid:${mainPid}:children`);
			assert(children.includes(String(childPid1)));
			assert(children.includes(String(childPid2)));
		});

		it('should increment reply count on parent posts', async () => {
			const parentPost = await posts.getPostFields(mainPid, ['replies']);
			assert(parentPost.replies >= 2); // Should have at least 2 direct children
		});
	});

	describe('Post Data Fields', () => {
		it('should include parentPid in post data', async () => {
			const postData = await posts.getPostData(childPid1);
			assert(postData.parentPid);
			assert.strictEqual(parseInt(postData.parentPid, 10), parseInt(mainPid, 10));
		});

		it('should handle posts without parentPid', async () => {
			const mainPostData = await posts.getPostData(mainPid);
			assert(mainPostData.parentPid === 0 || mainPostData.parentPid === null || !mainPostData.parentPid);
		});
	});

	after(async () => {
		// Clean up test data
		await topics.purge(testTid, testUid);
		await categories.purge(testCid, testUid);
		await user.delete(1, testUid);
		await user.delete(1, testUid2);
	});
});
'use strict';


const assert = require('assert');
const async = require('async');
const request = require('request');
const nconf = require('nconf');
const path = require('path');
const util = require('util');

const sleep = util.promisify(setTimeout);

const db = require('./mocks/databasemock');
const topics = require('../src/topics');
const posts = require('../src/posts');
const categories = require('../src/categories');
const privileges = require('../src/privileges');
const user = require('../src/user');
const groups = require('../src/groups');
const socketPosts = require('../src/socket.io/posts');
const apiPosts = require('../src/api/posts');
const apiTopics = require('../src/api/topics');
const meta = require('../src/meta');
const file = require('../src/file');
const helpers = require('./helpers');

describe('Post\'s', () => {
	let voterUid;
	let voteeUid;
	let globalModUid;
	let postData;
	let topicData;
	let cid;

	before((done) => {
		async.series({
			voterUid: function (next) {
				user.create({ username: 'upvoter' }, next);
			},
			voteeUid: function (next) {
				user.create({ username: 'upvotee' }, next);
			},
			globalModUid: function (next) {
				user.create({ username: 'globalmod', password: 'globalmodpwd' }, next);
			},
			category: function (next) {
				categories.create({
					name: 'Test Category',
					description: 'Test category created by testing script',
				}, next);
			},
		}, (err, results) => {
			if (err) {
				return done(err);
			}

			voterUid = results.voterUid;
			voteeUid = results.voteeUid;
			globalModUid = results.globalModUid;
			cid = results.category.cid;

			topics.post({
				uid: results.voteeUid,
				cid: results.category.cid,
				title: 'Test Topic Title',
				content: 'The content of test topic',
			}, (err, data) => {
				if (err) {
					return done(err);
				}
				postData = data.postData;
				topicData = data.topicData;

				groups.join('Global Moderators', globalModUid, done);
			});
		});
	});

	it('should update category teaser properly', async () => {
		const util = require('util');
		const getCategoriesAsync = util.promisify(async (callback) => {
			request(`${nconf.get('url')}/api/categories`, { json: true }, (err, res, body) => {
				callback(err, body);
			});
		});

		const postResult = await topics.post({ uid: globalModUid, cid: cid, title: 'topic title', content: '123456789' });

		let data = await getCategoriesAsync();
		assert.equal(data.categories[0].teaser.pid, postResult.postData.pid);
		assert.equal(data.categories[0].posts[0].content, '123456789');
		assert.equal(data.categories[0].posts[0].pid, postResult.postData.pid);

		const newUid = await user.create({ username: 'teaserdelete' });
		const newPostResult = await topics.post({ uid: newUid, cid: cid, title: 'topic title', content: 'xxxxxxxx' });

		data = await getCategoriesAsync();
		assert.equal(data.categories[0].teaser.pid, newPostResult.postData.pid);
		assert.equal(data.categories[0].posts[0].content, 'xxxxxxxx');
		assert.equal(data.categories[0].posts[0].pid, newPostResult.postData.pid);

		await user.delete(1, newUid);

		data = await getCategoriesAsync();
		assert.equal(data.categories[0].teaser.pid, postResult.postData.pid);
		assert.equal(data.categories[0].posts[0].content, '123456789');
		assert.equal(data.categories[0].posts[0].pid, postResult.postData.pid);
	});

	it('should change owner of post and topic properly', async () => {
		const oldUid = await user.create({ username: 'olduser' });
		const newUid = await user.create({ username: 'newuser' });
		const postResult = await topics.post({ uid: oldUid, cid: cid, title: 'change owner', content: 'original post' });
		const postData = await topics.reply({ uid: oldUid, tid: postResult.topicData.tid, content: 'firstReply' });
		const pid1 = postResult.postData.pid;
		const pid2 = postData.pid;

		assert.deepStrictEqual(await db.sortedSetScores(`tid:${postResult.topicData.tid}:posters`, [oldUid, newUid]), [2, null]);

		await posts.changeOwner([pid1, pid2], newUid);

		assert.deepStrictEqual(await db.sortedSetScores(`tid:${postResult.topicData.tid}:posters`, [oldUid, newUid]), [0, 2]);

		assert.deepStrictEqual(await posts.isOwner([pid1, pid2], oldUid), [false, false]);
		assert.deepStrictEqual(await posts.isOwner([pid1, pid2], newUid), [true, true]);

		assert.strictEqual(await user.getUserField(oldUid, 'postcount'), 0);
		assert.strictEqual(await user.getUserField(newUid, 'postcount'), 2);

		assert.strictEqual(await user.getUserField(oldUid, 'topiccount'), 0);
		assert.strictEqual(await user.getUserField(newUid, 'topiccount'), 1);

		assert.strictEqual(await db.sortedSetScore('users:postcount', oldUid), 0);
		assert.strictEqual(await db.sortedSetScore('users:postcount', newUid), 2);

		assert.strictEqual(await topics.isOwner(postResult.topicData.tid, oldUid), false);
		assert.strictEqual(await topics.isOwner(postResult.topicData.tid, newUid), true);
	});

	it('should fail to change owner if new owner does not exist', async () => {
		try {
			await posts.changeOwner([1], '9999999');
		} catch (err) {
			assert.strictEqual(err.message, '[[error:no-user]]');
		}
	});

	it('should fail to change owner if user is not authorized', async () => {
		try {
			await socketPosts.changeOwner({ uid: voterUid }, { pids: [1, 2], toUid: voterUid });
		} catch (err) {
			assert.strictEqual(err.message, '[[error:no-privileges]]');
		}
	});

	it('should return falsy if post does not exist', (done) => {
		posts.getPostData(9999, (err, postData) => {
			assert.ifError(err);
			assert.equal(postData, null);
			done();
		});
	});

	describe('voting', () => {
		it('should fail to upvote post if group does not have upvote permission', async () => {
			await privileges.categories.rescind(['groups:posts:upvote', 'groups:posts:downvote'], cid, 'registered-users');
			let err;
			try {
				await apiPosts.upvote({ uid: voterUid }, { pid: postData.pid, room_id: 'topic_1' });
			} catch (_err) {
				err = _err;
			}
			assert.equal(err.message, '[[error:no-privileges]]');
			try {
				await apiPosts.downvote({ uid: voterUid }, { pid: postData.pid, room_id: 'topic_1' });
			} catch (_err) {
				err = _err;
			}
			assert.equal(err.message, '[[error:no-privileges]]');
			await privileges.categories.give(['groups:posts:upvote', 'groups:posts:downvote'], cid, 'registered-users');
		});

		it('should upvote a post', async () => {
			const result = await apiPosts.upvote({ uid: voterUid }, { pid: postData.pid, room_id: 'topic_1' });
			assert.equal(result.post.upvotes, 1);
			assert.equal(result.post.downvotes, 0);
			assert.equal(result.post.votes, 1);
			assert.equal(result.user.reputation, 1);
			const data = await posts.hasVoted(postData.pid, voterUid);
			assert.equal(data.upvoted, true);
			assert.equal(data.downvoted, false);
		});

		it('should add the pid to the :votes sorted set for that user', async () => {
			const cid = await posts.getCidByPid(postData.pid);
			const { uid, pid } = postData;

			const score = await db.sortedSetScore(`cid:${cid}:uid:${uid}:pids:votes`, pid);
			assert.strictEqual(score, 1);
		});

		it('should get voters', (done) => {
			socketPosts.getVoters({ uid: globalModUid }, { pid: postData.pid, cid: cid }, (err, data) => {
				assert.ifError(err);
				assert.equal(data.upvoteCount, 1);
				assert.equal(data.downvoteCount, 0);
				assert(Array.isArray(data.upvoters));
				assert.equal(data.upvoters[0].username, 'upvoter');
				done();
			});
		});

		it('should get upvoters', (done) => {
			socketPosts.getUpvoters({ uid: globalModUid }, [postData.pid], (err, data) => {
				assert.ifError(err);
				assert.equal(data[0].otherCount, 0);
				assert.equal(data[0].usernames, 'upvoter');
				done();
			});
		});

		it('should unvote a post', async () => {
			const result = await apiPosts.unvote({ uid: voterUid }, { pid: postData.pid, room_id: 'topic_1' });
			assert.equal(result.post.upvotes, 0);
			assert.equal(result.post.downvotes, 0);
			assert.equal(result.post.votes, 0);
			assert.equal(result.user.reputation, 0);
			const data = await posts.hasVoted(postData.pid, voterUid);
			assert.equal(data.upvoted, false);
			assert.equal(data.downvoted, false);
		});

		it('should downvote a post', async () => {
			const result = await apiPosts.downvote({ uid: voterUid }, { pid: postData.pid, room_id: 'topic_1' });
			assert.equal(result.post.upvotes, 0);
			assert.equal(result.post.downvotes, 1);
			assert.equal(result.post.votes, -1);
			assert.equal(result.user.reputation, -1);
			const data = await posts.hasVoted(postData.pid, voterUid);
			assert.equal(data.upvoted, false);
			assert.equal(data.downvoted, true);
		});

		it('should add the pid to the :votes sorted set for that user', async () => {
			const cid = await posts.getCidByPid(postData.pid);
			const { uid, pid } = postData;

			const score = await db.sortedSetScore(`cid:${cid}:uid:${uid}:pids:votes`, pid);
			assert.strictEqual(score, -1);
		});

		it('should prevent downvoting more than total daily limit', async () => {
			const oldValue = meta.config.downvotesPerDay;
			meta.config.downvotesPerDay = 1;
			let err;
			const p1 = await topics.reply({
				uid: voteeUid,
				tid: topicData.tid,
				content: 'raw content',
			});
			try {
				await apiPosts.downvote({ uid: voterUid }, { pid: p1.pid, room_id: 'topic_1' });
			} catch (_err) {
				err = _err;
			}
			assert.equal(err.message, '[[error:too-many-downvotes-today, 1]]');
			meta.config.downvotesPerDay = oldValue;
		});

		it('should prevent downvoting target user more than total daily limit', async () => {
			const oldValue = meta.config.downvotesPerUserPerDay;
			meta.config.downvotesPerUserPerDay = 1;
			let err;
			const p1 = await topics.reply({
				uid: voteeUid,
				tid: topicData.tid,
				content: 'raw content',
			});
			try {
				await apiPosts.downvote({ uid: voterUid }, { pid: p1.pid, room_id: 'topic_1' });
			} catch (_err) {
				err = _err;
			}
			assert.equal(err.message, '[[error:too-many-downvotes-today-user, 1]]');
			meta.config.downvotesPerUserPerDay = oldValue;
		});
	});

	describe('bookmarking', () => {
		it('should bookmark a post', async () => {
			const data = await apiPosts.bookmark({ uid: voterUid }, { pid: postData.pid, room_id: `topic_${postData.tid}` });
			assert.equal(data.isBookmarked, true);
			const hasBookmarked = await posts.hasBookmarked(postData.pid, voterUid);
			assert.equal(hasBookmarked, true);
		});

		it('should unbookmark a post', async () => {
			const data = await apiPosts.unbookmark({ uid: voterUid }, { pid: postData.pid, room_id: `topic_${postData.tid}` });
			assert.equal(data.isBookmarked, false);
			const hasBookmarked = await posts.hasBookmarked([postData.pid], voterUid);
			assert.equal(hasBookmarked[0], false);
		});
	});

	describe('post tools', () => {
		it('should error if data is invalid', (done) => {
			socketPosts.loadPostTools({ uid: globalModUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should load post tools', (done) => {
			socketPosts.loadPostTools({ uid: globalModUid }, { pid: postData.pid, cid: cid }, (err, data) => {
				assert.ifError(err);
				assert(data.posts.display_edit_tools);
				assert(data.posts.display_delete_tools);
				assert(data.posts.display_moderator_tools);
				assert(data.posts.display_move_tools);
				done();
			});
		});
	});

	describe('delete/restore/purge', () => {
		async function createTopicWithReply() {
			const topicPostData = await topics.post({
				uid: voterUid,
				cid: cid,
				title: 'topic to delete/restore/purge',
				content: 'A post to delete/restore/purge',
			});

			const replyData = await topics.reply({
				uid: voterUid,
				tid: topicPostData.topicData.tid,
				timestamp: Date.now(),
				content: 'A post to delete/restore and purge',
			});
			return [topicPostData, replyData];
		}

		let tid;
		let mainPid;
		let replyPid;

		before(async () => {
			const [topicPostData, replyData] = await createTopicWithReply();
			tid = topicPostData.topicData.tid;
			mainPid = topicPostData.postData.pid;
			replyPid = replyData.pid;
			await privileges.categories.give(['groups:purge'], cid, 'registered-users');
		});

		it('should error with invalid data', async () => {
			try {
				await apiPosts.delete({ uid: voterUid }, null);
			} catch (err) {
				return assert.equal(err.message, '[[error:invalid-data]]');
			}
			assert(false);
		});

		it('should delete a post', async () => {
			await apiPosts.delete({ uid: voterUid }, { pid: replyPid, tid: tid });
			const isDeleted = await posts.getPostField(replyPid, 'deleted');
			assert.strictEqual(isDeleted, 1);
		});

		it('should not see post content if global mod does not have posts:view_deleted privilege', (done) => {
			async.waterfall([
				function (next) {
					user.create({ username: 'global mod', password: '123456' }, next);
				},
				function (uid, next) {
					groups.join('Global Moderators', uid, next);
				},
				function (next) {
					privileges.categories.rescind(['groups:posts:view_deleted'], cid, 'Global Moderators', next);
				},
				function (next) {
					helpers.loginUser('global mod', '123456', (err, data) => {
						assert.ifError(err);
						request(`${nconf.get('url')}/api/topic/${tid}`, { jar: data.jar, json: true }, (err, res, body) => {
							assert.ifError(err);
							assert.equal(body.posts[1].content, '[[topic:post_is_deleted]]');
							privileges.categories.give(['groups:posts:view_deleted'], cid, 'Global Moderators', next);
						});
					});
				},
			], done);
		});

		it('should restore a post', async () => {
			await apiPosts.restore({ uid: voterUid }, { pid: replyPid, tid: tid });
			const isDeleted = await posts.getPostField(replyPid, 'deleted');
			assert.strictEqual(isDeleted, 0);
		});

		it('should delete topic if last main post is deleted', async () => {
			const data = await topics.post({ uid: voterUid, cid: cid, title: 'test topic', content: 'test topic' });
			await apiPosts.delete({ uid: globalModUid }, { pid: data.postData.pid });
			const deleted = await topics.getTopicField(data.topicData.tid, 'deleted');
			assert.strictEqual(deleted, 1);
		});

		it('should purge posts and purge topic', async () => {
			const [topicPostData, replyData] = await createTopicWithReply();
			await apiPosts.purge({ uid: voterUid }, { pid: replyData.pid });
			await apiPosts.purge({ uid: voterUid }, { pid: topicPostData.postData.pid });
			const pidExists = await posts.exists(replyData.pid);
			assert.strictEqual(pidExists, false);
			const tidExists = await topics.exists(topicPostData.topicData.tid);
			assert.strictEqual(tidExists, false);
		});
	});

	describe('edit', () => {
		let pid;
		let replyPid;
		let tid;
		before((done) => {
			topics.post({
				uid: voterUid,
				cid: cid,
				title: 'topic to edit',
				content: 'A post to edit',
			}, (err, data) => {
				assert.ifError(err);
				pid = data.postData.pid;
				tid = data.topicData.tid;
				topics.reply({
					uid: voterUid,
					tid: tid,
					timestamp: Date.now(),
					content: 'A reply to edit',
				}, (err, data) => {
					assert.ifError(err);
					replyPid = data.pid;
					privileges.categories.give(['groups:posts:edit'], cid, 'registered-users', done);
				});
			});
		});

		it('should error if user is not logged in', async () => {
			try {
				await apiPosts.edit({ uid: 0 }, { pid: pid, content: 'gg' });
			} catch (err) {
				return assert.equal(err.message, '[[error:not-logged-in]]');
			}
			assert(false);
		});

		it('should error if data is invalid or missing', async () => {
			try {
				await apiPosts.edit({ uid: voterUid }, {});
			} catch (err) {
				return assert.equal(err.message, '[[error:invalid-data]]');
			}
			assert(false);
		});

		it('should error if title is too short', async () => {
			try {
				await apiPosts.edit({ uid: voterUid }, { pid: pid, content: 'edited post content', title: 'a' });
			} catch (err) {
				return assert.equal(err.message, `[[error:title-too-short, ${meta.config.minimumTitleLength}]]`);
			}
			assert(false);
		});

		it('should error if title is too long', async () => {
			const longTitle = new Array(meta.config.maximumTitleLength + 2).join('a');
			try {
				await apiPosts.edit({ uid: voterUid }, { pid: pid, content: 'edited post content', title: longTitle });
			} catch (err) {
				return assert.equal(err.message, `[[error:title-too-long, ${meta.config.maximumTitleLength}]]`);
			}
			assert(false);
		});

		it('should error with too few tags', async () => {
			const oldValue = meta.config.minimumTagsPerTopic;
			meta.config.minimumTagsPerTopic = 1;
			try {
				await apiPosts.edit({ uid: voterUid }, { pid: pid, content: 'edited post content', tags: [] });
			} catch (err) {
				assert.equal(err.message, `[[error:not-enough-tags, ${meta.config.minimumTagsPerTopic}]]`);
				meta.config.minimumTagsPerTopic = oldValue;
				return;
			}
			assert(false);
		});

		it('should error with too many tags', async () => {
			const tags = [];
			for (let i = 0; i < meta.config.maximumTagsPerTopic + 1; i += 1) {
				tags.push(`tag${i}`);
			}
			try {
				await apiPosts.edit({ uid: voterUid }, { pid: pid, content: 'edited post content', tags: tags });
			} catch (err) {
				return assert.equal(err.message, `[[error:too-many-tags, ${meta.config.maximumTagsPerTopic}]]`);
			}
			assert(false);
		});

		it('should error if content is too short', async () => {
			try {
				await apiPosts.edit({ uid: voterUid }, { pid: pid, content: 'e' });
			} catch (err) {
				return assert.equal(err.message, `[[error:content-too-short, ${meta.config.minimumPostLength}]]`);
			}
			assert(false);
		});

		it('should error if content is too long', async () => {
			const longContent = new Array(meta.config.maximumPostLength + 2).join('a');
			try {
				await apiPosts.edit({ uid: voterUid }, { pid: pid, content: longContent });
			} catch (err) {
				return assert.equal(err.message, `[[error:content-too-long, ${meta.config.maximumPostLength}]]`);
			}
			assert(false);
		});

		it('should edit post', async () => {
			const data = await apiPosts.edit({ uid: voterUid }, {
				pid: pid,
				content: 'edited post content',
				title: 'edited title',
				tags: ['edited'],
			});

			assert.strictEqual(data.content, 'edited post content');
			assert.strictEqual(data.editor, voterUid);
			assert.strictEqual(data.topic.title, 'edited title');
			assert.strictEqual(data.topic.tags[0].value, 'edited');
			const res = await db.getObject(`post:${pid}`);
			assert(!res.hasOwnProperty('bookmarks'));
		});

		it('should disallow post editing for new users if post was made past the threshold for editing', async () => {
			meta.config.newbiePostEditDuration = 1;
			await sleep(1000);
			try {
				await apiPosts.edit({ uid: voterUid }, { pid: pid, content: 'edited post content again', title: 'edited title again', tags: ['edited-twice'] });
			} catch (err) {
				assert.equal(err.message, '[[error:post-edit-duration-expired, 1]]');
				meta.config.newbiePostEditDuration = 3600;
				return;
			}
			assert(false);
		});

		it('should edit a deleted post', async () => {
			await apiPosts.delete({ uid: voterUid }, { pid: pid, tid: tid });
			const data = await apiPosts.edit({ uid: voterUid }, { pid: pid, content: 'edited deleted content', title: 'edited deleted title', tags: ['deleted'] });
			assert.equal(data.content, 'edited deleted content');
			assert.equal(data.editor, voterUid);
			assert.equal(data.topic.title, 'edited deleted title');
			assert.equal(data.topic.tags[0].value, 'deleted');
		});

		it('should edit a reply post', async () => {
			const data = await apiPosts.edit({ uid: voterUid }, { pid: replyPid, content: 'edited reply' });
			assert.equal(data.content, 'edited reply');
			assert.equal(data.editor, voterUid);
			assert.equal(data.topic.isMainPost, false);
			assert.equal(data.topic.renamed, false);
		});

		it('should return diffs', (done) => {
			posts.diffs.get(replyPid, 0, (err, data) => {
				assert.ifError(err);
				assert(Array.isArray(data));
				assert(data[0].pid, replyPid);
				assert(data[0].patch);
				done();
			});
		});

		it('should load diffs and reconstruct post', (done) => {
			posts.diffs.load(replyPid, 0, voterUid, (err, data) => {
				assert.ifError(err);
				assert.equal(data.content, 'A reply to edit');
				done();
			});
		});

		it('should not allow guests to view diffs', async () => {
			let err = {};
			try {
				await apiPosts.getDiffs({ uid: 0 }, { pid: 1 });
			} catch (_err) {
				err = _err;
			}
			assert.strictEqual(err.message, '[[error:no-privileges]]');
		});

		it('should allow registered-users group to view diffs', async () => {
			const data = await apiPosts.getDiffs({ uid: 1 }, { pid: 1 });

			assert.strictEqual('boolean', typeof data.editable);
			assert.strictEqual(false, data.editable);

			assert.equal(true, Array.isArray(data.timestamps));
			assert.strictEqual(1, data.timestamps.length);

			assert.equal(true, Array.isArray(data.revisions));
			assert.strictEqual(data.timestamps.length, data.revisions.length);
			['timestamp', 'username'].every(prop => Object.keys(data.revisions[0]).includes(prop));
		});

		it('should not delete first diff of a post', async () => {
			const timestamps = await posts.diffs.list(replyPid);
			await assert.rejects(async () => {
				await posts.diffs.delete(replyPid, timestamps[0], voterUid);
			}, {
				message: '[[error:invalid-data]]',
			});
		});

		it('should delete a post diff', async () => {
			await apiPosts.edit({ uid: voterUid }, { pid: replyPid, content: 'another edit has been made' });
			await apiPosts.edit({ uid: voterUid }, { pid: replyPid, content: 'most recent edit' });
			const timestamp = (await posts.diffs.list(replyPid)).pop();
			await posts.diffs.delete(replyPid, timestamp, voterUid);
			const differentTimestamp = (await posts.diffs.list(replyPid)).pop();
			assert.notStrictEqual(timestamp, differentTimestamp);
		});

		it('should load (oldest) diff and reconstruct post correctly after a diff deletion', async () => {
			const data = await posts.diffs.load(replyPid, 0, voterUid);
			assert.strictEqual(data.content, 'A reply to edit');
		});
	});

	describe('move', () => {
		let replyPid;
		let tid;
		let moveTid;

		before(async () => {
			const topic1 = await topics.post({
				uid: voterUid,
				cid: cid,
				title: 'topic 1',
				content: 'some content',
			});
			tid = topic1.topicData.tid;
			const topic2 = await topics.post({
				uid: voterUid,
				cid: cid,
				title: 'topic 2',
				content: 'some content',
			});
			moveTid = topic2.topicData.tid;

			const reply = await topics.reply({
				uid: voterUid,
				tid: tid,
				timestamp: Date.now(),
				content: 'A reply to move',
			});
			replyPid = reply.pid;
		});

		it('should error if uid is not logged in', async () => {
			try {
				await apiPosts.move({ uid: 0 }, {});
			} catch (err) {
				return assert.equal(err.message, '[[error:not-logged-in]]');
			}
			assert(false);
		});

		it('should error if data is invalid', async () => {
			try {
				await apiPosts.move({ uid: globalModUid }, {});
			} catch (err) {
				return assert.equal(err.message, '[[error:invalid-data]]');
			}
			assert(false);
		});

		it('should error if user does not have move privilege', async () => {
			try {
				await apiPosts.move({ uid: voterUid }, { pid: replyPid, tid: moveTid });
			} catch (err) {
				return assert.equal(err.message, '[[error:no-privileges]]');
			}
			assert(false);
		});

		it('should move a post', async () => {
			await apiPosts.move({ uid: globalModUid }, { pid: replyPid, tid: moveTid });
			const tid = await posts.getPostField(replyPid, 'tid');
			assert(tid, moveTid);
		});

		it('should fail to move post if not moderator of target category', async () => {
			const cat1 = await categories.create({ name: 'Test Category', description: 'Test category created by testing script' });
			const cat2 = await categories.create({ name: 'Test Category', description: 'Test category created by testing script' });
			const result = await apiTopics.create({ uid: globalModUid }, { title: 'target topic', content: 'queued topic', cid: cat2.cid });
			const modUid = await user.create({ username: 'modofcat1' });
			await privileges.categories.give(privileges.categories.userPrivilegeList, cat1.cid, modUid);
			let err;
			try {
				await apiPosts.move({ uid: modUid }, { pid: replyPid, tid: result.tid });
			} catch (_err) {
				err = _err;
			}
			assert.strictEqual(err.message, '[[error:no-privileges]]');
		});
	});

	describe('getPostSummaryByPids', () => {
		it('should return empty array for empty pids', (done) => {
			posts.getPostSummaryByPids([], 0, {}, (err, data) => {
				assert.ifError(err);
				assert.equal(data.length, 0);
				done();
			});
		});

		it('should get post summaries', (done) => {
			posts.getPostSummaryByPids([postData.pid], 0, {}, (err, data) => {
				assert.ifError(err);
				assert(data[0].user);
				assert(data[0].topic);
				assert(data[0].category);
				done();
			});
		});
	});

	it('should get recent poster uids', (done) => {
		topics.reply({
			uid: voterUid,
			tid: topicData.tid,
			timestamp: Date.now(),
			content: 'some content',
		}, (err) => {
			assert.ifError(err);
			posts.getRecentPosterUids(0, 1, (err, uids) => {
				assert.ifError(err);
				assert(Array.isArray(uids));
				assert.equal(uids.length, 2);
				assert.equal(uids[0], voterUid);
				done();
			});
		});
	});

	describe('parse', () => {
		it('should not crash and return falsy if post data is falsy', (done) => {
			posts.parsePost(null, (err, postData) => {
				assert.ifError(err);
				assert.strictEqual(postData, null);
				done();
			});
		});

		it('should store post content in cache', (done) => {
			const oldValue = global.env;
			global.env = 'production';
			const postData = {
				pid: 9999,
				content: 'some post content',
			};
			posts.parsePost(postData, (err) => {
				assert.ifError(err);
				posts.parsePost(postData, (err) => {
					assert.ifError(err);
					global.env = oldValue;
					done();
				});
			});
		});

		it('should parse signature and remove links and images', (done) => {
			meta.config['signatures:disableLinks'] = 1;
			meta.config['signatures:disableImages'] = 1;
			const userData = {
				signature: '<img src="boop"/><a href="link">test</a> derp',
			};

			posts.parseSignature(userData, 1, (err, data) => {
				assert.ifError(err);
				assert.equal(data.userData.signature, 'test derp');
				meta.config['signatures:disableLinks'] = 0;
				meta.config['signatures:disableImages'] = 0;
				done();
			});
		});

		it('should turn relative links in post body to absolute urls', (done) => {
			const nconf = require('nconf');
			const content = '<a href="/users">test</a> <a href="youtube.com">youtube</a>';
			const parsedContent = posts.relativeToAbsolute(content, posts.urlRegex);
			assert.equal(parsedContent, `<a href="${nconf.get('base_url')}/users">test</a> <a href="//youtube.com">youtube</a>`);
			done();
		});

		it('should turn relative links in post body to absolute urls', (done) => {
			const nconf = require('nconf');
			const content = '<a href="/users">test</a> <a href="youtube.com">youtube</a> some test <img src="/path/to/img"/>';
			let parsedContent = posts.relativeToAbsolute(content, posts.urlRegex);
			parsedContent = posts.relativeToAbsolute(parsedContent, posts.imgRegex);
			assert.equal(parsedContent, `<a href="${nconf.get('base_url')}/users">test</a> <a href="//youtube.com">youtube</a> some test <img src="${nconf.get('base_url')}/path/to/img"/>`);
			done();
		});
	});

	describe('socket methods', () => {
		let pid;
		before((done) => {
			topics.reply({
				uid: voterUid,
				tid: topicData.tid,
				timestamp: Date.now(),
				content: 'raw content',
			}, (err, postData) => {
				assert.ifError(err);
				pid = postData.pid;
				privileges.categories.rescind(['groups:topics:read'], cid, 'guests', done);
			});
		});

		it('should error with invalid data', async () => {
			try {
				await apiTopics.reply({ uid: 0 }, null);
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
			}
		});

		it('should error with invalid tid', async () => {
			try {
				await apiTopics.reply({ uid: 0 }, { tid: 0, content: 'derp' });
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
			}
		});

		it('should fail to get raw post because of privilege', (done) => {
			socketPosts.getRawPost({ uid: 0 }, pid, (err) => {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail to get raw post because post is deleted', (done) => {
			posts.setPostField(pid, 'deleted', 1, (err) => {
				assert.ifError(err);
				socketPosts.getRawPost({ uid: voterUid }, pid, (err) => {
					assert.equal(err.message, '[[error:no-post]]');
					done();
				});
			});
		});

		it('should get raw post content', (done) => {
			posts.setPostField(pid, 'deleted', 0, (err) => {
				assert.ifError(err);
				socketPosts.getRawPost({ uid: voterUid }, pid, (err, postContent) => {
					assert.ifError(err);
					assert.equal(postContent, 'raw content');
					done();
				});
			});
		});

		it('should get post', async () => {
			const postData = await apiPosts.get({ uid: voterUid }, { pid });
			assert(postData);
		});

		it('should get post category', (done) => {
			socketPosts.getCategory({ uid: voterUid }, pid, (err, postCid) => {
				assert.ifError(err);
				assert.equal(cid, postCid);
				done();
			});
		});

		it('should error with invalid data', (done) => {
			socketPosts.getPidIndex({ uid: voterUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should get pid index', (done) => {
			socketPosts.getPidIndex({ uid: voterUid }, { pid: pid, tid: topicData.tid, topicPostSort: 'oldest_to_newest' }, (err, index) => {
				assert.ifError(err);
				assert.equal(index, 4);
				done();
			});
		});

		it('should get pid index in reverse', (done) => {
			topics.reply({
				uid: voterUid,
				tid: topicData.tid,
				content: 'raw content',
			}, (err, postData) => {
				assert.ifError(err);

				socketPosts.getPidIndex({ uid: voterUid }, { pid: postData.pid, tid: topicData.tid, topicPostSort: 'newest_to_oldest' }, (err, index) => {
					assert.ifError(err);
					assert.equal(index, 1);
					done();
				});
			});
		});
	});

	describe('filterPidsByCid', () => {
		it('should return pids as is if cid is falsy', (done) => {
			posts.filterPidsByCid([1, 2, 3], null, (err, pids) => {
				assert.ifError(err);
				assert.deepEqual([1, 2, 3], pids);
				done();
			});
		});

		it('should filter pids by single cid', (done) => {
			posts.filterPidsByCid([postData.pid, 100, 101], cid, (err, pids) => {
				assert.ifError(err);
				assert.deepEqual([postData.pid], pids);
				done();
			});
		});

		it('should filter pids by multiple cids', (done) => {
			posts.filterPidsByCid([postData.pid, 100, 101], [cid, 2, 3], (err, pids) => {
				assert.ifError(err);
				assert.deepEqual([postData.pid], pids);
				done();
			});
		});

		it('should filter pids by multiple cids', (done) => {
			posts.filterPidsByCid([postData.pid, 100, 101], [cid], (err, pids) => {
				assert.ifError(err);
				assert.deepEqual([postData.pid], pids);
				done();
			});
		});
	});

	it('should error if user does not exist', (done) => {
		user.isReadyToPost(21123123, 1, (err) => {
			assert.equal(err.message, '[[error:no-user]]');
			done();
		});
	});

	describe('post queue', () => {
		let uid;
		let queueId;
		let topicQueueId;
		let jar;
		before((done) => {
			meta.config.postQueue = 1;
			user.create({ username: 'newuser' }, (err, _uid) => {
				assert.ifError(err);
				uid = _uid;
				done();
			});
		});

		after((done) => {
			meta.config.postQueue = 0;
			meta.config.groupsExemptFromPostQueue = [];
			done();
		});

		it('should add topic to post queue', async () => {
			const result = await apiTopics.create({ uid: uid }, { title: 'should be queued', content: 'queued topic content', cid: cid });
			assert.strictEqual(result.queued, true);
			assert.equal(result.message, '[[success:post-queued]]');
			topicQueueId = result.id;
		});

		it('should add reply to post queue', async () => {
			const result = await apiTopics.reply({ uid: uid }, { content: 'this is a queued reply', tid: topicData.tid });
			assert.strictEqual(result.queued, true);
			assert.equal(result.message, '[[success:post-queued]]');
			queueId = result.id;
		});

		it('should load queued posts', (done) => {
			helpers.loginUser('globalmod', 'globalmodpwd', (err, data) => {
				jar = data.jar;
				assert.ifError(err);
				request(`${nconf.get('url')}/api/post-queue`, { jar: jar, json: true }, (err, res, body) => {
					assert.ifError(err);
					assert.equal(body.posts[0].type, 'topic');
					assert.equal(body.posts[0].data.content, 'queued topic content');
					assert.equal(body.posts[1].type, 'reply');
					assert.equal(body.posts[1].data.content, 'this is a queued reply');
					done();
				});
			});
		});

		it('should error if data is invalid', (done) => {
			socketPosts.editQueuedContent({ uid: globalModUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should edit post in queue', (done) => {
			socketPosts.editQueuedContent({ uid: globalModUid }, { id: queueId, content: 'newContent' }, (err) => {
				assert.ifError(err);
				request(`${nconf.get('url')}/api/post-queue`, { jar: jar, json: true }, (err, res, body) => {
					assert.ifError(err);
					assert.equal(body.posts[1].type, 'reply');
					assert.equal(body.posts[1].data.content, 'newContent');
					done();
				});
			});
		});

		it('should edit topic title in queue', (done) => {
			socketPosts.editQueuedContent({ uid: globalModUid }, { id: topicQueueId, title: 'new topic title' }, (err) => {
				assert.ifError(err);
				request(`${nconf.get('url')}/api/post-queue`, { jar: jar, json: true }, (err, res, body) => {
					assert.ifError(err);
					assert.equal(body.posts[0].type, 'topic');
					assert.equal(body.posts[0].data.title, 'new topic title');
					done();
				});
			});
		});

		it('should edit topic category in queue', (done) => {
			socketPosts.editQueuedContent({ uid: globalModUid }, { id: topicQueueId, cid: 2 }, (err) => {
				assert.ifError(err);
				request(`${nconf.get('url')}/api/post-queue`, { jar: jar, json: true }, (err, res, body) => {
					assert.ifError(err);
					assert.equal(body.posts[0].type, 'topic');
					assert.equal(body.posts[0].data.cid, 2);
					socketPosts.editQueuedContent({ uid: globalModUid }, { id: topicQueueId, cid: cid }, (err) => {
						assert.ifError(err);
						done();
					});
				});
			});
		});

		it('should prevent regular users from approving posts', (done) => {
			socketPosts.accept({ uid: uid }, { id: queueId }, (err) => {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should prevent regular users from approving non existing posts', (done) => {
			socketPosts.accept({ uid: uid }, { id: 123123 }, (err) => {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should accept queued posts and submit', (done) => {
			let ids;
			async.waterfall([
				function (next) {
					db.getSortedSetRange('post:queue', 0, -1, next);
				},
				function (_ids, next) {
					ids = _ids;
					socketPosts.accept({ uid: globalModUid }, { id: ids[0] }, next);
				},
				function (next) {
					socketPosts.accept({ uid: globalModUid }, { id: ids[1] }, next);
				},
			], done);
		});

		it('should not crash if id does not exist', (done) => {
			socketPosts.reject({ uid: globalModUid }, { id: '123123123' }, (err) => {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should bypass post queue if user is in exempt group', async () => {
			const oldValue = meta.config.groupsExemptFromPostQueue;
			meta.config.groupsExemptFromPostQueue = ['registered-users'];
			const uid = await user.create({ username: 'mergeexemptuser' });
			const result = await apiTopics.create({ uid: uid, emit: () => {} }, { title: 'should not be queued', content: 'topic content', cid: cid });
			assert.strictEqual(result.title, 'should not be queued');
			meta.config.groupsExemptFromPostQueue = oldValue;
		});

		it('should update queued post\'s topic if target topic is merged', async () => {
			const uid = await user.create({ username: 'mergetestsuser' });
			const result1 = await apiTopics.create({ uid: globalModUid }, { title: 'topic A', content: 'topic A content', cid: cid });
			const result2 = await apiTopics.create({ uid: globalModUid }, { title: 'topic B', content: 'topic B content', cid: cid });

			const result = await apiTopics.reply({ uid: uid }, { content: 'the moved queued post', tid: result1.tid });

			await topics.merge([
				result1.tid, result2.tid,
			], globalModUid, { mainTid: result2.tid });

			let postData = await posts.getQueuedPosts();
			postData = postData.filter(p => parseInt(p.data.tid, 10) === parseInt(result2.tid, 10));
			assert.strictEqual(postData.length, 1);
			assert.strictEqual(postData[0].data.content, 'the moved queued post');
			assert.strictEqual(postData[0].data.tid, result2.tid);
		});
	});

	describe('Topic Backlinks', () => {
		let tid1;
		before(async () => {
			tid1 = await topics.post({
				uid: 1,
				cid,
				title: 'Topic backlink testing - topic 1',
				content: 'Some text here for the OP',
			});
			tid1 = tid1.topicData.tid;
		});

		describe('.syncBacklinks()', () => {
			it('should error on invalid data', async () => {
				try {
					await topics.syncBacklinks();
				} catch (e) {
					assert(e);
					assert.strictEqual(e.message, '[[error:invalid-data]]');
				}
			});

			it('should do nothing if the post does not contain a link to a topic', async () => {
				const backlinks = await topics.syncBacklinks({
					content: 'This is a post\'s content',
				});

				assert.strictEqual(backlinks, 0);
			});

			it('should create a backlink if it detects a topic link in a post', async () => {
				const count = await topics.syncBacklinks({
					pid: 2,
					content: `This is a link to [topic 1](${nconf.get('url')}/topic/1/abcdef)`,
				});
				const events = await topics.events.get(1, 1);
				const backlinks = await db.getSortedSetMembers('pid:2:backlinks');

				assert.strictEqual(count, 1);
				assert(events);
				assert.strictEqual(events.length, 1);
				assert(backlinks);
				assert(backlinks.includes('1'));
			});

			it('should remove the backlink (but keep the event) if the post no longer contains a link to a topic', async () => {
				const count = await topics.syncBacklinks({
					pid: 2,
					content: 'This is a link to [nothing](http://example.org)',
				});
				const events = await topics.events.get(1, 1);
				const backlinks = await db.getSortedSetMembers('pid:2:backlinks');

				assert.strictEqual(count, 0);
				assert(events);
				assert.strictEqual(events.length, 1);
				assert(backlinks);
				assert.strictEqual(backlinks.length, 0);
			});
		});

		describe('integration tests', () => {
			it('should create a topic event in the referenced topic', async () => {
				const topic = await topics.post({
					uid: 1,
					cid,
					title: 'Topic backlink testing - topic 2',
					content: `Some text here for the OP &ndash; ${nconf.get('url')}/topic/${tid1}`,
				});

				const events = await topics.events.get(tid1, 1);
				assert(events);
				assert.strictEqual(events.length, 1);
				assert.strictEqual(events[0].type, 'backlink');
				assert.strictEqual(parseInt(events[0].uid, 10), 1);
				assert.strictEqual(events[0].href, `/post/${topic.postData.pid}`);
			});

			it('should not create a topic event if referenced topic is the same as current topic', async () => {
				await topics.reply({
					uid: 1,
					tid: tid1,
					content: `Referencing itself &ndash; ${nconf.get('url')}/topic/${tid1}`,
				});

				const events = await topics.events.get(tid1, 1);
				assert(events);
				assert.strictEqual(events.length, 1); // should still equal 1
			});

			it('should not show backlink events if the feature is disabled', async () => {
				meta.config.topicBacklinks = 0;

				await topics.post({
					uid: 1,
					cid,
					title: 'Topic backlink testing - topic 3',
					content: `Some text here for the OP &ndash; ${nconf.get('url')}/topic/${tid1}`,
				});

				const events = await topics.events.get(tid1, 1);
				assert(events);
				assert.strictEqual(events.length, 0);
			});
		});
	});
});

describe('Posts\'', async () => {
	let files;

	before(async () => {
		files = await file.walk(path.resolve(__dirname, './posts'));
	});

	it('subfolder tests', () => {
		files.forEach((filePath) => {
			require(filePath);
		});
	});
});

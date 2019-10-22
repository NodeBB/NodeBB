'use strict';

const db = require('../../database');
const batch = require('../../batch');
const posts = require('../../posts');
const topics = require('../../topics');

module.exports = {
	name: 'Clean up post hash data',
	timestamp: Date.UTC(2019, 9, 7),
	method: async function (callback) {
		const progress = this.progress;
		await cleanPost(progress);
		await cleanTopic(progress);
		callback();
	},
};

async function cleanPost(progress) {
	await batch.processSortedSet('posts:pid', async function (pids) {
		progress.incr(pids.length);

		const postData = await posts.getPostsData(pids);
		await Promise.all(postData.map(async function (post) {
			if (!post) {
				return;
			}
			const fields = [];
			if (post.editor === '') {
				fields.push('editor');
			}
			if (post.deleted === 0) {
				fields.push('deleted');
			}
			if (post.edited === 0) {
				fields.push('edited');
			}

			// cleanup legacy fields, these are not used anymore
			const legacyFields = [
				'show_banned', 'fav_star_class', 'relativeEditTime',
				'post_rep', 'relativeTime', 'fav_button_class',
				'edited-class',
			];
			legacyFields.forEach((field) => {
				if (post.hasOwnProperty(field)) {
					fields.push(field);
				}
			});

			if (fields.length) {
				await db.deleteObjectFields('post:' + post.pid, fields);
			}
		}));
	}, {
		batch: 500,
		progress: progress,
	});
}

async function cleanTopic(progress) {
	await batch.processSortedSet('topics:tid', async function (tids) {
		progress.incr(tids.length);
		const topicData = await topics.getTopicsData(tids);
		await Promise.all(topicData.map(async function (topic) {
			if (!topic) {
				return;
			}
			const fields = [];
			if (topic.deleted === 0) {
				fields.push('deleted');
			}
			if (topic.pinned === 0) {
				fields.push('pinned');
			}
			if (topic.locked === 0) {
				fields.push('locked');
			}

			// cleanup legacy fields, these are not used anymore
			const legacyFields = [
				'category_name', 'category_slug',
			];
			legacyFields.forEach((field) => {
				if (topic.hasOwnProperty(field)) {
					fields.push(field);
				}
			});

			if (fields.length) {
				await db.deleteObjectFields('topic:' + topic.tid, fields);
			}
		}));
	}, {
		batch: 500,
		progress: progress,
	});
}

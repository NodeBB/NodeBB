'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Clean up post hash data',
	timestamp: Date.UTC(2019, 9, 7),
	method: async function () {
		const { progress } = this;
		await cleanPost(progress);
		await cleanTopic(progress);
	},
};

async function cleanPost(progress) {
	await batch.processSortedSet('posts:pid', async (pids) => {
		progress.incr(pids.length);

		const postData = await db.getObjects(pids.map(pid => `post:${pid}`));
		await Promise.all(postData.map(async (post) => {
			if (!post) {
				return;
			}
			const fieldsToDelete = [];
			if (post.hasOwnProperty('editor') && post.editor === '') {
				fieldsToDelete.push('editor');
			}
			if (post.hasOwnProperty('deleted') && parseInt(post.deleted, 10) === 0) {
				fieldsToDelete.push('deleted');
			}
			if (post.hasOwnProperty('edited') && parseInt(post.edited, 10) === 0) {
				fieldsToDelete.push('edited');
			}

			// cleanup legacy fields, these are not used anymore
			const legacyFields = [
				'show_banned', 'fav_star_class', 'relativeEditTime',
				'post_rep', 'relativeTime', 'fav_button_class',
				'edited-class',
			];
			legacyFields.forEach((field) => {
				if (post.hasOwnProperty(field)) {
					fieldsToDelete.push(field);
				}
			});

			if (fieldsToDelete.length) {
				await db.deleteObjectFields(`post:${post.pid}`, fieldsToDelete);
			}
		}));
	}, {
		batch: 500,
		progress: progress,
	});
}

async function cleanTopic(progress) {
	await batch.processSortedSet('topics:tid', async (tids) => {
		progress.incr(tids.length);
		const topicData = await db.getObjects(tids.map(tid => `topic:${tid}`));
		await Promise.all(topicData.map(async (topic) => {
			if (!topic) {
				return;
			}
			const fieldsToDelete = [];
			if (topic.hasOwnProperty('deleted') && parseInt(topic.deleted, 10) === 0) {
				fieldsToDelete.push('deleted');
			}
			if (topic.hasOwnProperty('pinned') && parseInt(topic.pinned, 10) === 0) {
				fieldsToDelete.push('pinned');
			}
			if (topic.hasOwnProperty('locked') && parseInt(topic.locked, 10) === 0) {
				fieldsToDelete.push('locked');
			}

			// cleanup legacy fields, these are not used anymore
			const legacyFields = [
				'category_name', 'category_slug',
			];
			legacyFields.forEach((field) => {
				if (topic.hasOwnProperty(field)) {
					fieldsToDelete.push(field);
				}
			});

			if (fieldsToDelete.length) {
				await db.deleteObjectFields(`topic:${topic.tid}`, fieldsToDelete);
			}
		}));
	}, {
		batch: 500,
		progress: progress,
	});
}

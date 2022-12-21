'use strict';

const db = require('../../database');
const batch = require('../../batch');
const user = require('../../user');

module.exports = {
	name: 'Clean up old notifications and hash data',
	timestamp: Date.UTC(2019, 9, 7),
	method: async function () {
		const { progress } = this;
		const week = 604800000;
		const cutoffTime = Date.now() - week;
		await batch.processSortedSet('users:joindate', async (uids) => {
			progress.incr(uids.length);
			await Promise.all([
				db.sortedSetsRemoveRangeByScore(uids.map(uid => `uid:${uid}:notifications:unread`), '-inf', cutoffTime),
				db.sortedSetsRemoveRangeByScore(uids.map(uid => `uid:${uid}:notifications:read`), '-inf', cutoffTime),
			]);
			const userData = await user.getUsersData(uids);
			await Promise.all(userData.map(async (user) => {
				if (!user) {
					return;
				}
				const fields = [];
				['picture', 'fullname', 'location', 'birthday', 'website', 'signature', 'uploadedpicture'].forEach((field) => {
					if (user[field] === '') {
						fields.push(field);
					}
				});
				['profileviews', 'reputation', 'postcount', 'topiccount', 'lastposttime', 'banned', 'followerCount', 'followingCount'].forEach((field) => {
					if (user[field] === 0) {
						fields.push(field);
					}
				});
				if (user['icon:text']) {
					fields.push('icon:text');
				}
				if (user['icon:bgColor']) {
					fields.push('icon:bgColor');
				}
				if (fields.length) {
					await db.deleteObjectFields(`user:${user.uid}`, fields);
				}
			}));
		}, {
			batch: 500,
			progress: progress,
		});
	},
};

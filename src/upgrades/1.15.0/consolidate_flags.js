'use strict';

const db = require('../../database');
const batch = require('../../batch');
const posts = require('../../posts');
const user = require('../../user');

module.exports = {
	name: 'Consolidate multiple flags reports, going forward',
	timestamp: Date.UTC(2020, 6, 16),
	method: async function () {
		const { progress } = this;

		let flags = await db.getSortedSetRange('flags:datetime', 0, -1);
		flags = flags.map(flagId => `flag:${flagId}`);
		flags = await db.getObjectsFields(flags, ['flagId', 'type', 'targetId', 'uid', 'description', 'datetime']);
		progress.total = flags.length;

		await batch.processArray(flags, async (subset) => {
			progress.incr(subset.length);

			await Promise.all(subset.map(async (flagObj) => {
				const methods = [];
				switch (flagObj.type) {
					case 'post':
						methods.push(posts.setPostField.bind(posts, flagObj.targetId, 'flagId', flagObj.flagId));
						break;

					case 'user':
						methods.push(user.setUserField.bind(user, flagObj.targetId, 'flagId', flagObj.flagId));
						break;
				}

				methods.push(
					db.sortedSetAdd.bind(db, `flag:${flagObj.flagId}:reports`, flagObj.datetime, String(flagObj.description).slice(0, 250)),
					db.sortedSetAdd.bind(db, `flag:${flagObj.flagId}:reporters`, flagObj.datetime, flagObj.uid)
				);

				await Promise.all(methods.map(async method => method()));
			}));
		}, {
			progress: progress,
			batch: 500,
		});
	},
};

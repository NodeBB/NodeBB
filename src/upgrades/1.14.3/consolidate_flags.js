'use strict';

const db = require('../../database');
const batch = require('../../batch');
const posts = require('../../posts');
const user = require('../../user');

module.exports = {
	name: 'Consolidate multiple flags reports, going forward',
	timestamp: Date.UTC(2020, 6, 16),
	method: async function () {
		const progress = this.progress;

		let flags = await db.getSortedSetRange('flags:datetime', 0, -1);
		flags = flags.map(flagId => `flag:${flagId}`);
		flags = await db.getObjectsFields(flags, ['flagId', 'type', 'targetId']);
		progress.total = flags.length;

		await batch.processArray(flags, async function (subset) {
			progress.incr(subset.length);

			await Promise.all(subset.map(async (flagObj) => {
				switch (flagObj.type) {
					case 'post':
						await posts.setPostField(flagObj.targetId, 'flagId', flagObj.flagId);
						break;

					case 'user':
						await user.setUserField(flagObj.targetId, 'flagId', flagObj.flagId);
						break;
				}
			}));
		}, {
			progress: progress,
			batch: 500,
		});
	},
};

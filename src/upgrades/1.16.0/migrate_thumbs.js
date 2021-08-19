'use strict';

const nconf = require('nconf');

const db = require('../../database');
const meta = require('../../meta');
const topics = require('../../topics');
const batch = require('../../batch');

module.exports = {
	name: 'Migrate existing topic thumbnails to new format',
	timestamp: Date.UTC(2020, 11, 11),
	method: async function () {
		const { progress } = this;
		const current = await meta.configs.get('topicThumbSize');

		if (parseInt(current, 10) === 120) {
			await meta.configs.set('topicThumbSize', 512);
		}

		await batch.processSortedSet('topics:tid', async (tids) => {
			const keys = tids.map(tid => `topic:${tid}`);
			const topicThumbs = (await db.getObjectsFields(keys, ['thumb']))
				.map(obj => (obj.thumb ? obj.thumb.replace(nconf.get('upload_url'), '') : null));

			await Promise.all(tids.map(async (tid, idx) => {
				const path = topicThumbs[idx];
				if (path) {
					if (path.length < 255 && !path.startsWith('data:')) {
						await topics.thumbs.associate({ id: tid, path });
					}
					await db.deleteObjectField(keys[idx], 'thumb');
				}

				progress.incr();
			}));
		}, {
			batch: 500,
			progress: progress,
		});
	},
};

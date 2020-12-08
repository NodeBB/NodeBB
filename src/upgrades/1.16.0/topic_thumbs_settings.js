'use strict';

const meta = require('../../meta');

module.exports = {
	name: 'Config changes for new topic thumbnails',
	timestamp: Date.UTC(2020, 11, 8),
	method: async () => {
		const current = await meta.configs.get('topicThumbSize');

		if (parseInt(current, 10) === 120) {
			await meta.configs.set('topicThumbSize', 512);
		}
		await meta.configs.set('allowTopicsThumbnail', 1);
	},
};

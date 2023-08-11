'use strict';


const db = require('../../database');

module.exports = {
	name: 'Reset old bootswatch skin for all users',
	timestamp: Date.UTC(2023, 4, 1),
	method: async function () {
		const batch = require('../../batch');
		const css = require('../../meta/css');

		batch.processSortedSet('users:joindate', async (uids) => {
			let settings = await db.getObjects(uids.map(uid => `user:${uid}:settings`));
			settings = settings.filter(
				s => s && s.bootswatchSkin && !css.supportedSkins.includes(s.bootswatchSkin)
			);

			await db.setObjectBulk(settings.map(s => ([`user:${s.uid}`, { bootswatchSkin: '' }])));
		}, {
			batch: 500,
		});
	},
};

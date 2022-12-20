'use strict';

import db from '../../database';



export const obj = {
	name: 'Disable nodebb-plugin-soundpack-default',
	timestamp: Date.UTC(2020, 8, 6),
	method: async function () {
		await db.sortedSetRemove('plugins:active', 'nodebb-plugin-soundpack-default');
	},
};

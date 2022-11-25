'use strict';

import * as database from '../../database';
const db = database as any;

export default  {
	name: 'Disable nodebb-plugin-soundpack-default',
	timestamp: Date.UTC(2020, 8, 6),
	method: async function () {
		await db.sortedSetRemove('plugins:active', 'nodebb-plugin-soundpack-default');
	},
};

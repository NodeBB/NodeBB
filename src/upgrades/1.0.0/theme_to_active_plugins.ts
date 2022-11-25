'use strict';

import * as database from '../../database';
const db = database as any;


export default  {
	name: 'Adding theme to active plugins sorted set',
	timestamp: Date.UTC(2015, 11, 23),
	method: async function () {
		const themeId = await db.getObjectField('config', 'theme:id');
		await db.sortedSetAdd('plugins:active', 0, themeId);
	},
};

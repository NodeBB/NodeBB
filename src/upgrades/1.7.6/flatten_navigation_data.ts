'use strict';

import { primaryDB as db } from '../../database';

export default  {
	name: 'Flatten navigation data',
	timestamp: Date.UTC(2018, 1, 17),
	method: async function () {
		const data = await db.getSortedSetRangeWithScores('navigation:enabled', 0, -1);
		const order : any[] = [];
		const items : any[] = [];
		data.forEach((item) => {
			let navItem = JSON.parse(item.value);
			const keys = Object.keys(navItem);
			if (keys.length && parseInt(keys[0], 10) >= 0) {
				navItem = navItem[keys[0]];
			}
			order.push(item.score);
			items.push(JSON.stringify(navItem));
		});
		await db.delete('navigation:enabled');
		await db.sortedSetAdd('navigation:enabled', order, items);
	},
};

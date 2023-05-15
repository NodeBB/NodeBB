'use strict';

const assert = require('assert');
const winston = require('winston');

const db = require('../../database');
const meta = require('../../meta');
const api = require('../../api');

module.exports = {
	name: 'Migrate tokens away from sorted-list implementation',
	timestamp: Date.UTC(2023, 4, 2),
	method: async () => {
		const { tokens = [] } = await meta.settings.get('core.api');

		await Promise.all(tokens.map(async (tokenObj) => {
			const { token, uid, description } = tokenObj;
			await api.utils.tokens.add({ token, uid, description });
		}));

		// Validate
		const oldCount = await db.sortedSetCard('settings:core.api:sorted-list:tokens');
		const newCount = await db.sortedSetCard('tokens:createtime');
		try {
			if (oldCount > 0) {
				assert.strictEqual(oldCount, newCount);
			}

			// Delete old tokens
			await meta.settings.set('core.api', {
				tokens: [],
			});
			await db.delete('settings:core.api:sorted-lists');
		} catch (e) {
			winston.warn('Old token count does not match migrated tokens count, leaving old tokens behind.');
		}
	},
};

'use strict';

const db = require('../../database');
const activitypub = require('../../activitypub');

module.exports = {
	name: 'Migrate activitypubFilterList config to core blocklist',
	timestamp: Date.UTC(2026, 5, 1),
	method: async function () {
		const list = await db.getObjectField('config', 'activitypubFilterList');
		if (!list) {
			return;
		}

		const domains = String(list)
			.split('\n')
			.map(d => d.trim())
			.filter(d => d.length > 0);

		if (!domains.length) {
			await db.deleteObjectField('config', 'activitypubFilterList');
			return;
		}

		// Ensure core blocklist is registered
		const exists = await db.isSortedSetMember('blocklists', 'core');
		if (!exists) {
			await db.sortedSetAdd('blocklists', Date.now(), 'core');
		}

		// Clear any existing core domains (idempotent)
		await db.delete('blocklist:core');
		await db.delete('blocklist:core:severity');

		// Add migrated domains with default severity (suspend = 1)
		await db.sortedSetAdd(
			'blocklist:core',
			domains.map(() => 1),
			domains
		);
		await db.setObject(
			'blocklist:core:severity',
			domains.reduce((obj, d) => { obj[d] = 'suspend'; return obj; }, {})
		);

		// Remove old config field
		await db.deleteObjectField('config', 'activitypubFilterList');

		activitypub.helpers.log(`[upgrade] Migrated ${domains.length} domains to core blocklist`);
	},
};

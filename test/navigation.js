'use strict';

const assert = require('assert');

const db = require('./mocks/databasemock');
const meta = require('../src/meta');
const navAdmin = require('../src/navigation/admin');

describe('Navigation', () => {
	before(async () => {
		const data = require('../install/data/navigation.json');
		await navAdmin.save(data);
	});

	it('should toggle /world route when ap is toggled', async () => {
		let nav = await navAdmin.get();
		let world = nav.find(item => item.route === '&#x2F;world');
		assert.strictEqual(!!world.enabled, true);
		await meta.configs.setMultiple({ activitypubEnabled: 0 });
		nav = await navAdmin.get();
		world = nav.find(item => item.route === '&#x2F;world');
		assert.strictEqual(!!world.enabled, false);
	});
});

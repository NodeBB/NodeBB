'use strict';

'use strict';

const db = require('./mocks/databasemock');

const assert = require('assert');
const categories = require('../src/categories');
const user = require('../src/user');
const groups = require('../src/groups');
const privileges = require('../src/privileges');


describe('Privileges', () => {
	let categoryObj;
	let regularUid;
	let adminUid;

	before(async () => {
		regularUid = await user.create({ username: 'poster' });
		adminUid = await user.create({ username: 'admin' });
		await groups.join('administrators', adminUid);
		categoryObj = await categories.create({ name: 'asd' });
	});


	it('should return false if user is not a moderator', async () => {
		assert.strictEqual(
			await privileges.categories.isAdminOrMod(categoryObj.cid, regularUid),
			false
		);

		assert.strictEqual(
			await privileges.categories.isAdminOrMod([categoryObj.cid], regularUid),
			false
		);
	});
});


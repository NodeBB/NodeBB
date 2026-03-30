'use strict';

const nconf = require('nconf');
const assert = require('assert');

const db = require('../mocks/databasemock');

const user = require('../../src/user');
const groups = require('../../src/groups');

const request = require('../../src/request');
const adminUser = require('../../src/socket.io/admin/user');


describe('custom user fields', () => {
	let adminUid;
	let lowRepUid;
	let highRepUid;
	before(async () => {
		adminUid = await user.create({ username: 'admin' });
		await groups.join('administrators', adminUid);
		lowRepUid = await user.create({ username: 'lowRepUser' });
		highRepUid = await user.create({ username: 'highRepUser' });
		await db.setObjectField(`user:${highRepUid}`, 'reputation', 10);
		await db.sortedSetAdd(`users:reputation`, 10, highRepUid);
	});

	it('should create custom user fields', async () => {
		const fields = [
			{ key: 'website', icon: 'fa-solid fa-globe', name: 'Website', type: 'input-link', visibility: 'all', 'min:rep': 0 },
			{ key: 'location', icon: 'fa-solid fa-pin', name: 'Location', type: 'input-text', visibility: 'all', 'min:rep': 0 },
			{ key: 'favouriteDate', icon: '', name: 'Anniversary', type: 'input-date', visibility: 'all', 'min:rep': 0 },
			{ key: 'favouriteLanguages', icon: 'fa-solid fa-code', name: 'Favourite Languages', type: 'select-multi', visibility: 'all', 'min:rep': 0, 'select-options': 'C++\nC\nJavascript\nPython\nAssembly' },
			{ key: 'luckyNumber', icon: 'fa-solid fa-dice', name: 'Lucky Number', type: 'input-number', visibility: 'privileged', 'min:rep': 7 },
			{ key: 'soccerTeam', icon: 'fa-regular fa-futbol', name: 'Soccer Team', type: 'select', visibility: 'all', 'min:rep': 0, 'select-options': 'Barcelona\nLiverpool\nArsenal\nGalatasaray\n' },
		];
		await adminUser.saveCustomFields({ uid: adminUid }, fields);
	});

	it('should fail to update a field if user does not have enough reputation', async () => {
		await assert.rejects(
			user.updateProfile(lowRepUid, {
				uid: lowRepUid,
				luckyNumber: 13,
			}),
			{ message: '[[error:not-enough-reputation-custom-field, 7, Lucky Number]]' },
		);
	});

	it('should fail with invalid field data', async () => {
		await assert.rejects(
			user.updateProfile(highRepUid, {
				uid: highRepUid,
				location: new Array(300).fill('a').join(''),
			}),
			{ message: '[[error:custom-user-field-value-too-long, Location]]' },
		);

		await assert.rejects(
			user.updateProfile(highRepUid, {
				uid: highRepUid,
				luckyNumber: 'not-a-number',
			}),
			{ message: '[[error:custom-user-field-invalid-number, Lucky Number]]' },
		);

		await assert.rejects(
			user.updateProfile(highRepUid, {
				uid: highRepUid,
				location: 'https://spam.com',
			}),
			{ message: '[[error:custom-user-field-invalid-text, Location]]' },
		);

		await assert.rejects(
			user.updateProfile(highRepUid, {
				uid: highRepUid,
				favouriteDate: 'not-a-date',
			}),
			{ message: '[[error:custom-user-field-invalid-date, Anniversary]]' },
		);

		await assert.rejects(
			user.updateProfile(highRepUid, {
				uid: highRepUid,
				website: 'not-a-url',
			}),
			{ message: '[[error:custom-user-field-invalid-link, Website]]' },
		);

		await assert.rejects(
			user.updateProfile(highRepUid, {
				uid: highRepUid,
				website: 'javascript:alert("xss")',
			}),
			{ message: '[[error:custom-user-field-invalid-link, Website]]' },
		);

		await assert.rejects(
			user.updateProfile(highRepUid, {
				uid: highRepUid,
				soccerTeam: 'not-in-options',
			}),
			{ message: '[[error:custom-user-field-select-value-invalid, Soccer Team]]' },
		);

		await assert.rejects(
			user.updateProfile(highRepUid, {
				uid: highRepUid,
				favouriteLanguages: '["not-in-options"]',
			}),
			{ message: '[[error:custom-user-field-select-value-invalid, Favourite Languages]]' },
		);
	});

	it('should update a users custom fields if they have enough reputation', async () => {
		await user.updateProfile(highRepUid, {
			uid: highRepUid,
			website: 'https://nodebb.org',
			location: 'Toronto',
			favouriteDate: '2014-05-01',
			favouriteLanguages: '["Javascript", "Python"]',
			luckyNumber: 13,
			soccerTeam: 'Galatasaray',
		});

		const { body } = await request.get(`${nconf.get('url')}/api/user/highrepuser`);
		assert.strictEqual(body.website, 'https://nodebb.org');
	});
});

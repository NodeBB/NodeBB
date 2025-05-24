import assert from 'assert';

import './mocks/databasemock.mjs';
import groups from '../src/groups/index.js';
import user from '../src/user/index.js';
import blacklist from '../src/meta/blacklist.js';
import socketBlacklist from '../src/socket.io/blacklist.js';

describe('blacklist', () => {
	let adminUid;

	before(async () => {
		adminUid = await user.create({ username: 'admin' });
		await groups.join('administrators', adminUid);
	});

	it('should validate blacklist', async () => {
		const rules = '1.1.1.1\n2.2.2.2\n::ffff:0:2.2.2.2\n127.0.0.1\n192.168.100.0/22';
		const data = await new Promise((resolve, reject) => {
			socketBlacklist.validate({ uid: adminUid }, { rules }, (err, result) => {
				if (err) reject(err);
				else resolve(result);
			});
		});
		assert(data);
	});

	it('should error if not admin', async () => {
		const rules = '1.1.1.1\n2.2.2.2\n::ffff:0:2.2.2.2\n127.0.0.1\n192.168.100.0/22';
		await assert.rejects(
			async () =>
				new Promise((resolve, reject) => {
					socketBlacklist.save({ uid: 0 }, rules, (err, result) => {
						if (err) reject(err);
						else resolve(result);
					});
				}),
			{ message: '[[error:no-privileges]]' }
		);
	});

	it('should save blacklist', async () => {
		const rules = '1.1.1.1\n2.2.2.2\n::ffff:0:2.2.2.2\n127.0.0.1\n192.168.100.0/22';
		await new Promise((resolve, reject) => {
			socketBlacklist.save({ uid: adminUid }, rules, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	});

	it('should pass ip test against blacklist', async () => {
		await blacklist.test('3.3.3.3');
	});

	it('should fail ip test against blacklist', async () => {
		await assert.rejects(
			async () => blacklist.test('1.1.1.1'),
			{ message: '[[error:blacklisted-ip]]' }
		);
	});

	it('should fail ip test against blacklist with port', async () => {
		await assert.rejects(
			async () => blacklist.test('1.1.1.1:4567'),
			{ message: '[[error:blacklisted-ip]]' }
		);
	});

	it('should pass ip test and not crash with ipv6 address', async () => {
		await blacklist.test('2001:db8:85a3:0:0:8a2e:370:7334');
	});

	it('should fail ip test due to cidr', async () => {
		await assert.rejects(
			async () => blacklist.test('192.168.100.1'),
			{ message: '[[error:blacklisted-ip]]' }
		);
	});
});
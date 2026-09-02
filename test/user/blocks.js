'use strict';

const assert = require('assert');

const db = require('../mocks/databasemock');
const User = require('../../src/user');
const socketUser = require('../../src/socket.io/user');
const utils = require('../../src/utils');

describe('user blocking methods', () => {
	let blockeeUid;
	let blockerUid;
	before(async () => {
		blockeeUid = String(await User.create({
			username: 'blockee',
			email: 'blockee@example.org',
			fullname: 'Block me',
		}));
		blockerUid = String(await User.create({
			username: 'blocker',
			email: 'blocker@example.org',
			fullname: 'Blocker',
		}));
	});

	describe('.toggle()', () => {
		it('should toggle block', async () => {
			await socketUser.toggleBlock({ uid: blockerUid }, { blockerUid, blockeeUid, action: 'block' });
			const blocked = await User.blocks.is(blockeeUid, blockerUid);
			assert.deepStrictEqual(await db.getSortedSetRevRange(`uid:${blockerUid}:blocked_uids`, 0, -1), [blockeeUid]);
			assert.deepStrictEqual(await db.getSortedSetRevRange(`uid:${blockeeUid}:blocker_uids`, 0, -1), [blockerUid]);
			assert(blocked);
		});


		it('should toggle block', async () => {
			await socketUser.toggleBlock({ uid: blockerUid }, { blockerUid, blockeeUid, action: 'unblock' });
			const blocked = await User.blocks.is(blockeeUid, blockerUid);
			assert.deepStrictEqual(await db.getSortedSetRevRange(`uid:${blockerUid}:blocked_uids`, 0, -1), []);
			assert.deepStrictEqual(await db.getSortedSetRevRange(`uid:${blockeeUid}:blocker_uids`, 0, -1), []);
			assert(!blocked);
		});
	});

	describe('.add()', () => {
		it('should block a uid', (done) => {
			User.blocks.add(blockeeUid, blockerUid, (err) => {
				assert.ifError(err);
				User.blocks.list(blockerUid, (err, blocked_uids) => {
					assert.ifError(err);
					assert.strictEqual(Array.isArray(blocked_uids), true);
					assert.strictEqual(blocked_uids.length, 1);
					assert.strictEqual(blocked_uids.includes(blockeeUid), true);
					done();
				});
			});
		});

		it('should automatically increment corresponding user field', (done) => {
			db.getObjectField(`user:${blockerUid}`, 'blocksCount', (err, count) => {
				assert.ifError(err);
				assert.strictEqual(parseInt(count, 10), 1);
				done();
			});
		});

		it('should error if you try to block the same uid again', (done) => {
			User.blocks.add(blockeeUid, blockerUid, (err) => {
				assert.equal(err.message, '[[error:already-blocked]]');
				done();
			});
		});
	});

	it('should clean up blocker/blocked sets when blocked user is deleted', async () => {
		const deleteUid = String(await User.create({ username: utils.generateUUID().slice(0, 6) }));
		const blockerUid = String(await User.create({ username: utils.generateUUID().slice(0, 6) }));
		await User.blocks.add(deleteUid, blockerUid);
		assert.deepStrictEqual(await db.getSortedSetRevRange(`uid:${blockerUid}:blocked_uids`, 0, -1), [deleteUid]);
		assert.deepStrictEqual(await db.getSortedSetRevRange(`uid:${deleteUid}:blocker_uids`, 0, -1), [blockerUid]);
		await User.deleteAccount(deleteUid);
		assert.deepStrictEqual(await db.getSortedSetRevRange(`uid:${blockerUid}:blocked_uids`, 0, -1), []);
		assert.deepStrictEqual(await db.getSortedSetRevRange(`uid:${deleteUid}:blocker_uids`, 0, -1), []);
	});

	describe('.remove()', () => {
		it('should unblock a uid', (done) => {
			User.blocks.remove(blockeeUid, blockerUid, (err) => {
				assert.ifError(err);
				User.blocks.list(blockerUid, (err, blocked_uids) => {
					assert.ifError(err);
					assert.strictEqual(Array.isArray(blocked_uids), true);
					assert.strictEqual(blocked_uids.length, 0);
					done();
				});
			});
		});

		it('should automatically decrement corresponding user field', (done) => {
			db.getObjectField(`user:${blockerUid}`, 'blocksCount', (err, count) => {
				assert.ifError(err);
				assert.strictEqual(parseInt(count, 10), 0);
				done();
			});
		});

		it('should error if you try to unblock the same uid again', (done) => {
			User.blocks.remove(blockeeUid, blockerUid, (err) => {
				assert.equal(err.message, '[[error:already-unblocked]]');
				done();
			});
		});
	});

	describe('.is()', () => {
		before((done) => {
			User.blocks.add(blockeeUid, blockerUid, done);
		});

		it('should return a Boolean with blocked status for the queried uid', (done) => {
			User.blocks.is(blockeeUid, blockerUid, (err, blocked) => {
				assert.ifError(err);
				assert.strictEqual(blocked, true);
				done();
			});
		});
	});

	describe('.list()', () => {
		it('should return a list of blocked uids', (done) => {
			User.blocks.list(blockerUid, (err, blocked_uids) => {
				assert.ifError(err);
				assert.strictEqual(Array.isArray(blocked_uids), true);
				assert.strictEqual(blocked_uids.length, 1);
				assert.strictEqual(blocked_uids.includes(blockeeUid), true);
				done();
			});
		});
	});

	describe('.filter()', () => {
		it('should remove entries by blocked uids and return filtered set', (done) => {
			User.blocks.filter(blockerUid, [{
				foo: 'foo',
				uid: blockeeUid,
			}, {
				foo: 'bar',
				uid: blockerUid,
			}, {
				foo: 'baz',
				uid: blockeeUid,
			}], (err, filtered) => {
				assert.ifError(err);
				assert.strictEqual(Array.isArray(filtered), true);
				assert.strictEqual(filtered.length, 1);
				assert.equal(filtered[0].uid, blockerUid);
				done();
			});
		});

		it('should allow property argument to be passed in to customise checked property', (done) => {
			User.blocks.filter(blockerUid, 'fromuid', [{
				foo: 'foo',
				fromuid: blockeeUid,
			}, {
				foo: 'bar',
				fromuid: blockerUid,
			}, {
				foo: 'baz',
				fromuid: blockeeUid,
			}], (err, filtered) => {
				assert.ifError(err);
				assert.strictEqual(Array.isArray(filtered), true);
				assert.strictEqual(filtered.length, 1);
				assert.equal(filtered[0].fromuid, blockerUid);
				done();
			});
		});

		it('should not process invalid sets', (done) => {
			User.blocks.filter(blockerUid, [{ foo: 'foo' }, { foo: 'bar' }, { foo: 'baz' }], (err, filtered) => {
				assert.ifError(err);
				assert.strictEqual(Array.isArray(filtered), true);
				assert.strictEqual(filtered.length, 3);
				filtered.forEach((obj) => {
					assert.strictEqual(obj.hasOwnProperty('foo'), true);
				});
				done();
			});
		});

		it('should process plain sets that just contain uids', (done) => {
			User.blocks.filter(blockerUid, [blockerUid, blockeeUid], (err, filtered) => {
				assert.ifError(err);
				assert.strictEqual(filtered.length, 1);
				assert.strictEqual(filtered[0], blockerUid);
				done();
			});
		});

		it('should filter uids that are blocking targetUid', (done) => {
			User.blocks.filterUids(blockeeUid, [blockerUid, blockeeUid], (err, filtered) => {
				assert.ifError(err);
				assert.deepEqual(filtered, [blockeeUid]);
				done();
			});
		});
	});
});
'use strict';

const assert = require('assert');
const { setTimeout } = require('node:timers/promises');

const db = require('./mocks/databasemock');
const meta = require('../src/meta');
const User = require('../src/user');
const Groups = require('../src/groups');
const Topics = require('../src/topics');
const Categories = require('../src/categories');
const rewards = require('../src/rewards');
const socketAdmin = require('../src/socket.io/admin');

describe('rewards', () => {
	let adminUid;

	before(async () => {
		// Create 3 users: 1 admin, 2 regular
		adminUid = await User.create({ username: 'foo' });
		await Groups.join('administrators', adminUid);
		await Groups.join('rewardGroup', adminUid);
	});

	describe('rewards create', () => {
		it('it should save a reward', (done) => {
			const data = [
				{
					rewards: { groupname: 'Gamers' },
					condition: 'essentials/user.postcount',
					conditional: 'greaterthan',
					value: '10',
					rid: 'essentials/add-to-group',
					claimable: '1',
					id: '',
					disabled: false,
				},
			];

			socketAdmin.rewards.save({ uid: adminUid }, data, (err) => {
				assert.ifError(err);
				done();
			});
		});
	});

	describe('rewards checkCondition', () => {
		it('should check condition', (done) => {
			function method(next) {
				next(null, 1);
			}
			rewards.checkConditionAndRewardUser({
				uid: adminUid,
				condition: 'essentials/user.postcount',
				method: method,
			}, (err, data) => {
				assert.ifError(err);
				done();
			});
		});

		it('should award user 10 reputation after posting 2 times only once', async () => {
			const data = [
				{
					rewards: { reputation: 10 },
					condition: 'essentials/user.postcount',
					conditional: 'greaterthan',
					value: '1',
					rid: 'essentials/award-reputation',
					claimable: '1',
					id: '',
					disabled: false,
				},
			];
			const { cid } = await Categories.create({
				name: 'test category',
				description: 'test category description',
			});

			await socketAdmin.rewards.save({ uid: adminUid }, data);
			const uid = await User.create({ username: 'poster' });
			await Topics.post({ uid, cid, title: 'test topic', content: 'test content' });
			await Topics.post({ uid, cid, title: 'test topic 2', content: 'test content' });
			await setTimeout(2000);
			const reputation = await User.getUserField(uid, 'reputation');
			assert.equal(reputation, 10);
			await Topics.post({ uid, cid, title: 'test topic 3', content: 'test content' });
			const reputation2 = await User.getUserField(uid, 'reputation');
			assert.equal(reputation2, 10);
		});
	});
});

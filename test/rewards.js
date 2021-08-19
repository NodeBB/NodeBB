'use strict';

const assert = require('assert');
const async = require('async');

const db = require('./mocks/databasemock');
const meta = require('../src/meta');
const User = require('../src/user');
const Groups = require('../src/groups');

describe('rewards', () => {
	let adminUid;
	let bazUid;
	let herpUid;

	before((done) => {
		// Create 3 users: 1 admin, 2 regular
		async.series([
			async.apply(User.create, { username: 'foo' }),
			async.apply(User.create, { username: 'baz' }),
			async.apply(User.create, { username: 'herp' }),
		], (err, uids) => {
			if (err) {
				return done(err);
			}

			adminUid = uids[0];
			bazUid = uids[1];
			herpUid = uids[2];

			async.series([
				function (next) {
					Groups.join('administrators', adminUid, next);
				},
				function (next) {
					Groups.join('rewardGroup', adminUid, next);
				},
			], done);
		});
	});

	describe('rewards create', () => {
		const socketAdmin = require('../src/socket.io/admin');
		const rewards = require('../src/rewards');
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
	});
});

'use strict';

const async = require('async');
const LRU = require('lru-cache');

const db = require('../database');
const pubsub = require('../pubsub');
const plugins = require('../plugins');

module.exports = function (User) {
	User.blocks = {
		_cache: new LRU({
			max: 100,
			length: function () { return 1; },
			maxAge: 0,
		}),
	};

	User.blocks.is = async function (targetUid, uid) {
		const blocks = await User.blocks.list(uid);
		return blocks.includes(parseInt(targetUid, 10));
	};

	User.blocks.can = async function (callerUid, blockerUid, blockeeUid) {
		// Guests can't block
		if (blockerUid === 0 || blockeeUid === 0) {
			throw new Error('[[error:cannot-block-guest]]');
		} else if (blockerUid === blockeeUid) {
			throw new Error('[[error:cannot-block-self]]');
		}

		// Administrators and global moderators cannot be blocked
		// Only admins/mods can block users as another user
		const [isCallerAdminOrMod, isBlockeeAdminOrMod] = await Promise.all([
			User.isAdminOrGlobalMod(callerUid),
			User.isAdminOrGlobalMod(blockeeUid),
		]);
		if (isBlockeeAdminOrMod) {
			throw new Error('[[error:cannot-block-privileged]]');
		}
		if (parseInt(callerUid, 10) !== parseInt(blockerUid, 10) && !isCallerAdminOrMod) {
			throw new Error('[[error:no-privileges]]');
		}
	};

	User.blocks.list = async function (uid) {
		if (User.blocks._cache.has(parseInt(uid, 10))) {
			return User.blocks._cache.get(parseInt(uid, 10));
		}

		let blocked = await db.getSortedSetRange('uid:' + uid + ':blocked_uids', 0, -1);
		blocked = blocked.map(uid => parseInt(uid, 10)).filter(Boolean);
		User.blocks._cache.set(parseInt(uid, 10), blocked);
		return blocked;
	};

	pubsub.on('user:blocks:cache:del', function (uid) {
		User.blocks._cache.del(uid);
	});

	User.blocks.add = async function (targetUid, uid) {
		await User.blocks.applyChecks('block', targetUid, uid);
		await db.sortedSetAdd('uid:' + uid + ':blocked_uids', Date.now(), targetUid);
		await User.incrementUserFieldBy(uid, 'blocksCount', 1);
		User.blocks._cache.del(parseInt(uid, 10));
		pubsub.publish('user:blocks:cache:del', parseInt(uid, 10));
		plugins.fireHook('action:user.blocks.add', { uid: uid, targetUid: targetUid });
	};

	User.blocks.remove = async function (targetUid, uid) {
		await User.blocks.applyChecks('unblock', targetUid, uid);
		await db.sortedSetRemove('uid:' + uid + ':blocked_uids', targetUid);
		await User.decrementUserFieldBy(uid, 'blocksCount', 1);
		User.blocks._cache.del(parseInt(uid, 10));
		pubsub.publish('user:blocks:cache:del', parseInt(uid, 10));
		plugins.fireHook('action:user.blocks.remove', { uid: uid, targetUid: targetUid });
	};

	User.blocks.applyChecks = async function (type, targetUid, uid) {
		await User.blocks.can(uid, uid, targetUid);
		const isBlock = type === 'block';
		const is = await User.blocks.is(targetUid, uid);
		if (is === isBlock) {
			throw new Error('[[error:already-' + (isBlock ? 'blocked' : 'unblocked') + ']]');
		}
	};

	User.blocks.filterUids = async function (targetUid, uids) {
		return await async.filter(uids, async function (uid) {
			const isBlocked = await User.blocks.is(targetUid, uid);
			return !isBlocked;
		});
	};

	User.blocks.filter = async function (uid, property, set) {
		// Given whatever is passed in, iterates through it, and removes entries made by blocked uids
		// property is optional
		if (Array.isArray(property) && typeof set === 'undefined') {
			set = property;
			property = 'uid';
		}

		if (!Array.isArray(set) || !set.length) {
			return set;
		}

		const isPlain = typeof set[0] !== 'object';
		const blocked_uids = await User.blocks.list(uid);
		const blockedSet = new Set(blocked_uids);

		set = set.filter(function (item) {
			return !blockedSet.has(parseInt(isPlain ? item : (item && item[property]), 10));
		});
		const data = await plugins.fireHook('filter:user.blocks.filter', { set: set, property: property, uid: uid, blockedSet: blockedSet });

		return data.set;
	};
};

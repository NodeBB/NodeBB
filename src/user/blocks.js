'use strict';

var async = require('async');
var db = require('../database');

module.exports = function (User) {
	User.blocks = {};

	User.blocks.is = function (targetUid, uid, callback) {
		db.isSortedSetMember('uid:' + uid + ':blocked_uids', String(targetUid), callback);
	};

	User.blocks.can = function (callerUid, blockerUid, blockeeUid, callback) {
		// Administrators and global moderators cannot be blocked
		async.waterfall([
			function (next) {
				async.parallel({
					isCallerAdminOrMod: function (next) {
						User.isAdminOrGlobalMod(callerUid, next);
					},
					isBlockeeAdminOrMod: function (next) {
						User.isAdminOrGlobalMod(blockeeUid, next);
					},
				}, next);
			},
			function (results, next) {
				if (results.isBlockeeAdminOrMod) {
					return callback(null, false);
				}
				if (parseInt(callerUid, 10) !== parseInt(blockerUid, 10) && !results.isCallerAdminOrMod) {
					return callback(null, false);
				}
				next(null, true);
			},
		], callback);
	};

	User.blocks.list = function (uid, callback) {
		db.getSortedSetRange('uid:' + uid + ':blocked_uids', 0, -1, function (err, blocked) {
			if (err) {
				return callback(err);
			}

			blocked = blocked.map(uid => parseInt(uid, 10)).filter(Boolean);
			callback(null, blocked);
		});
	};

	User.blocks.add = function (targetUid, uid, callback) {
		async.waterfall([
			async.apply(this.applyChecks, true, targetUid, uid),
			async.apply(db.sortedSetAdd.bind(db), 'uid:' + uid + ':blocked_uids', Date.now(), targetUid),
			async.apply(User.incrementUserFieldBy, uid, 'blocksCount', 1),
		], callback);
	};

	User.blocks.remove = function (targetUid, uid, callback) {
		async.waterfall([
			async.apply(this.applyChecks, false, targetUid, uid),
			async.apply(db.sortedSetRemove.bind(db), 'uid:' + uid + ':blocked_uids', targetUid),
			async.apply(User.decrementUserFieldBy, uid, 'blocksCount', 1),
		], callback);
	};

	User.blocks.applyChecks = function (block, targetUid, uid, callback) {
		if (parseInt(targetUid, 10) === parseInt(uid, 10)) {
			return setImmediate(callback, new Error('[[error:cannot-block-self]]'));
		}

		User.blocks.is(targetUid, uid, function (err, is) {
			callback(err || (is === block ? new Error('[[error:already-' + (block ? 'blocked' : 'unblocked') + ']]') : null));
		});
	};

	User.blocks.filterUids = function (targetUid, uids, callback) {
		const sets = uids.map(uid => 'uid:' + uid + ':blocked_uids');
		db.isMemberOfSortedSets(sets, targetUid, function (err, isMembers) {
			if (err) {
				return callback(err);
			}
			uids = uids.filter((uid, index) => isMembers[index]);
			callback(null, uids);
		});
	};

	User.blocks.filter = function (uid, property, set, callback) {
		// Given whatever is passed in, iterates through it, and removes entries made by blocked uids
		// property is optional
		if (Array.isArray(property) && typeof set === 'function' && !callback) {
			callback = set;
			set = property;
			property = 'uid';
		}

		if (!Array.isArray(set) || !set.length || !set.every((item) => {
			if (!item) {
				return false;
			}

			const check = item.hasOwnProperty(property) ? item[property] : item;
			return ['number', 'string'].includes(typeof check);
		})) {
			return callback(null, set);
		}

		const isPlain = typeof set[0] !== 'object';
		User.blocks.list(uid, function (err, blocked_uids) {
			if (err) {
				return callback(err);
			}

			set = set.filter(function (item) {
				return !blocked_uids.includes(parseInt(isPlain ? item : item[property], 10));
			});

			callback(null, set);
		});
	};
};

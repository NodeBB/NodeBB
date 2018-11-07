'use strict';


var async = require('async');
var db = require('../database');
var plugins = require('../plugins');

var rewards = module.exports;

rewards.checkConditionAndRewardUser = function (uid, condition, method, callback) {
	callback = callback || function () {};

	async.waterfall([
		function (next) {
			isConditionActive(condition, next);
		},
		function (isActive, next) {
			if (!isActive) {
				return callback();
			}
			getIDsByCondition(condition, next);
		},
		function (ids, next) {
			getRewardDataByIDs(ids, next);
		},
		function (rewards, next) {
			filterCompletedRewards(uid, rewards, next);
		},
		function (rewards, next) {
			if (!rewards || !rewards.length) {
				return callback();
			}

			async.filter(rewards, function (reward, next) {
				if (!reward) {
					return next(null, false);
				}

				checkCondition(reward, method, next);
			}, function (err, eligible) {
				if (err || !eligible) {
					return next(false);
				}

				giveRewards(uid, eligible, next);
			});
		},
	], callback);
};

function isConditionActive(condition, callback) {
	db.isSetMember('conditions:active', condition, callback);
}

function getIDsByCondition(condition, callback) {
	db.getSetMembers('condition:' + condition + ':rewards', callback);
}

function filterCompletedRewards(uid, rewards, callback) {
	async.waterfall([
		function (next) {
			db.getSortedSetRangeByScoreWithScores('uid:' + uid + ':rewards', 0, -1, 1, '+inf', next);
		},
		function (data, next) {
			var userRewards = {};

			data.forEach(function (obj) {
				userRewards[obj.value] = parseInt(obj.score, 10);
			});

			rewards = rewards.filter(function (reward) {
				if (!reward) {
					return false;
				}

				var claimable = parseInt(reward.claimable, 10);
				return claimable === 0 || (!userRewards[reward.id] || userRewards[reward.id] < reward.claimable);
			});

			next(null, rewards);
		},
	], callback);
}

function getRewardDataByIDs(ids, callback) {
	db.getObjects(ids.map(function (id) {
		return 'rewards:id:' + id;
	}), callback);
}

function getRewardsByRewardData(rewards, callback) {
	db.getObjects(rewards.map(function (reward) {
		return 'rewards:id:' + reward.id + ':rewards';
	}), callback);
}

function checkCondition(reward, method, callback) {
	async.waterfall([
		function (next) {
			method(next);
		},
		function (value, next) {
			plugins.fireHook('filter:rewards.checkConditional:' + reward.conditional, { left: value, right: reward.value }, next);
		},
		function (bool, next) {
			next(null, bool);
		},
	], callback);
}

function giveRewards(uid, rewards, callback) {
	async.waterfall([
		function (next) {
			getRewardsByRewardData(rewards, next);
		},
		function (rewardData, next) {
			async.each(rewards, function (reward, next) {
				plugins.fireHook('action:rewards.award:' + reward.rid, { uid: uid, reward: rewardData[rewards.indexOf(reward)] });
				db.sortedSetIncrBy('uid:' + uid + ':rewards', 1, reward.id, next);
			}, next);
		},
	], callback);
}

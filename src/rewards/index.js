"use strict";

var rewards = {},
	db = require('../database'),
	plugins = require('../plugins'),
	async = require('async');


rewards.checkConditionAndRewardUser = function(uid, condition, method, callback) {
	async.waterfall([
		function(next) {
			isConditionActive(condition, function(err, isActive) {
				if (!isActive) {
					return back(err);
				}

				next(err);
			});
		},
		function(next) {
			getIDsByCondition(condition, function(err, ids) {
				next(err, ids);
			});
		},
		function(ids, next) {
			getRewardDataByIDs(ids, next);
		},
		function(rewards, next) {
			filterCompletedRewards(uid, rewards, function(err, filtered) {
				if (!filtered || !filtered.length) {
					return back(err);
				}

				next(err, filtered);
			});
		},
		function(rewards, next) {
			async.filter(rewards, function(reward, next) {
				if (!reward) {
					return next(false);
				}

				checkCondition(reward, method, next);
			}, function(eligible) {
				if (!eligible) {
					return next(false);
				}

				giveRewards(uid, eligible, next);
			});
		}
	], back);


	function back(err) {
		if (typeof callback === 'function') {
			callback(err);
		}
	}
};

function isConditionActive(condition, callback) {
	db.isSetMember('conditions:active', condition, callback);
}

function getIDsByCondition(condition, callback) {
	db.getSetMembers('condition:' + condition + ':rewards', callback);
}

function filterCompletedRewards(uid, rewards, callback) {
	db.getSortedSetRangeByScoreWithScores('uid:' + uid + ':rewards', 0, -1, 1, '+inf', function(err, data) {
		if (err) {
			return callback(err);
		}

		var userRewards = {};

		data.forEach(function(obj) {
			userRewards[obj.value] = parseInt(obj.score, 10);
		});

		rewards = rewards.filter(function(reward) {
			if (!reward) {
				return false;
			}

			var claimable = parseInt(reward.claimable, 10);

			if (claimable === 0) {
				return true;
			}

			return (userRewards[reward.id] >= reward.claimable) ? false : true;
		});

		callback(false, rewards);
	});
}

function getRewardDataByIDs(ids, callback) {
	db.getObjects(ids.map(function(id) {
		return 'rewards:id:' + id;
	}), callback);
}

function getRewardsByRewardData(rewards, callback) {
	db.getObjects(rewards.map(function(reward) {
		return 'rewards:id:' + reward.id + ':rewards';
	}), callback);
}

function checkCondition(reward, method, callback) {
	method(function(err, value) {
		plugins.fireHook('filter:rewards.checkConditional:' + reward.conditional, {left: value, right: reward.value}, function(err, bool) {
			callback(bool);
		});
	});
}

function giveRewards(uid, rewards, callback) {
	getRewardsByRewardData(rewards, function(err, rewardData) {
		async.each(rewards, function(reward, next) {
			plugins.fireHook('action:rewards.award:' + reward.rid, {uid: uid, reward: rewardData[rewards.indexOf(reward)]});
			db.sortedSetIncrBy('uid:' + uid + ':rewards', 1, reward.id, next);
		}, callback);
	});
}


module.exports = rewards;
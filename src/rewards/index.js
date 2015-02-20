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
			filterIncompleteIDs(uid, ids, function(err, filtered) {
				if (!filtered || !filtered.length) {
					return back(err);
				}

				next(err, filtered);
			});
		},
		function(ids, next) {
			getRewardDataByIDs(ids, next);
		},
		function(rewards, next) {
			async.filter(rewards, function(reward, next) {
				if (!reward) {
					return next(false);
				}

				checkCondition(reward, method, next);
			}, function(err, eligible) {
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

function filterIncompleteIDs(uid, ids, callback) {
	// todo
	callback(false, ids);
}

function getRewardDataByIDs(ids, callback) {
	ids = ids.map(function(id) {
		return 'rewards:id:' + id;
	});

	db.getObjects(ids, function(err, objs) {
		callback(err, objs);
	});
}

function getRewardsByRewardData(rewards, callback) {
	rewards = rewards.map(function(reward) {
		return 'rewards:id:' + reward.id + ':rewards';
	});

	db.getObjects(rewards, callback);
}

function checkCondition(reward, method, callback) {
	method(function(err, value) {
		plugins.fireHook('filter:rewards.checkConditional:' + reward.conditional, {left: value, right: reward.value}, callback);
	});
}

function giveRewards(uid, rewards, callback) {
	getRewardsByRewardData(rewards, function(err, rewardData) {
		async.each(rewards, function(reward, next) {
			var index = rewards.indexOf(reward);

			plugins.fireHook('action:rewards.award:' + reward.rid, {uid: uid, reward: rewardData[index]});
		});
	});
}


module.exports = rewards;
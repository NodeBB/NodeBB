"use strict";

var rewards = {},
	async = require('async'),
	plugins = require('../plugins'),
	db = require('../database');


rewards.save = function(data, callback) {
	function save(data, next) {
		if (!Object.keys(data.rewards).length) {
			return next();
		}

		var rewards = data.rewards;
		delete data.rewards;

		async.parallel([
			function(next) {
				db.setAdd('rewards:list', data.id, next);
			},
			function(next) {
				db.setObject('rewards:id:' + data.id, data, next);
			},
			function(next) {
				db.setObject('rewards:id:' + data.id + ':rewards', rewards, next);
			}
		], next);
	}

	async.each(data, save, function(err) {
		saveConditions(data, callback);
	});
};

rewards.delete = function(data, callback) {
	async.parallel([
		function(next) {
			db.setRemove('rewards:list', data.id, next);
		},
		function(next) {
			db.delete('rewards:id:' + data.id, next);
		},
		function(next) {
			db.delete('rewards:id:' + data.id + ':rewards', next);
		}
	], callback);
};

rewards.get = function(callback) {
	async.parallel({
		active: getActiveRewards,
		conditions: function(next) {
			plugins.fireHook('filter:rewards.conditions', [], next);
		},
		conditionals: function(next) {
			plugins.fireHook('filter:rewards.conditionals', [], next);
		},
		rewards: function(next) {
			plugins.fireHook('filter:rewards.rewards', [], next);
		}
	}, callback);
};

function saveConditions(data, callback) {
	db.delete('conditions:active', function(err) {
		if (err) {
			return callback(err);
		}

		var conditions = [],
			rewardsPerCondition = {};

		data.forEach(function(reward) {
			conditions.push(reward.condition);
			rewardsPerCondition[reward.condition] = rewardsPerCondition[reward.condition] || [];
			rewardsPerCondition[reward.condition].push(reward.id);
		});

		db.setAdd('conditions:active', conditions, callback);

		async.each(Object.keys(rewardsPerCondition), function(condition, next) {
			db.setAdd('condition:' + condition + ':rewards', rewardsPerCondition[condition]);
		}, callback);
	});
}

function getActiveRewards(callback) {
	var activeRewards = [];

	function load(id, next) {
		async.parallel({
			main: function(next) {
				db.getObject('rewards:id:' + id, next);
			},
			rewards: function(next) {
				db.getObject('rewards:id:' + id + ':rewards', next);
			}
		}, function(err, data) {
			data.main.rewards = data.rewards;
			activeRewards.push(data.main);

			next(err);
		});
	}

	db.getSetMembers('rewards:list', function(err, rewards) {
		async.eachSeries(rewards, load, function(err) {
			callback(err, activeRewards);
		});
	});
}

module.exports = rewards;
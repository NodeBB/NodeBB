'use strict';

var async = require('async');
var plugins = require('../plugins');
var db = require('../database');

var rewards = module.exports;

rewards.save = function (data, callback) {
	async.each(data, function save(data, next) {
		if (!Object.keys(data.rewards).length) {
			return next();
		}

		var rewardsData = data.rewards;
		delete data.rewards;

		async.waterfall([
			function (next) {
				if (!parseInt(data.id, 10)) {
					db.incrObjectField('global', 'rewards:id', next);
				} else {
					next(null, data.id);
				}
			},
			function (rid, next) {
				data.id = rid;

				async.series([
					function (next) {
						rewards.delete(data, next);
					},
					function (next) {
						db.setAdd('rewards:list', data.id, next);
					},
					function (next) {
						db.setObject('rewards:id:' + data.id, data, next);
					},
					function (next) {
						db.setObject('rewards:id:' + data.id + ':rewards', rewardsData, next);
					},
				], next);
			},
		], next);
	}, function (err) {
		if (err) {
			return callback(err);
		}

		saveConditions(data, callback);
	});
};

rewards.delete = function (data, callback) {
	async.parallel([
		function (next) {
			db.setRemove('rewards:list', data.id, next);
		},
		function (next) {
			db.delete('rewards:id:' + data.id, next);
		},
		function (next) {
			db.delete('rewards:id:' + data.id + ':rewards', next);
		},
	], callback);
};

rewards.get = function (callback) {
	async.parallel({
		active: getActiveRewards,
		conditions: function (next) {
			plugins.fireHook('filter:rewards.conditions', [], next);
		},
		conditionals: function (next) {
			plugins.fireHook('filter:rewards.conditionals', [], next);
		},
		rewards: function (next) {
			plugins.fireHook('filter:rewards.rewards', [], next);
		},
	}, callback);
};

function saveConditions(data, callback) {
	var rewardsPerCondition = {};
	async.waterfall([
		function (next) {
			db.delete('conditions:active', next);
		},
		function (next) {
			var conditions = [];

			data.forEach(function (reward) {
				conditions.push(reward.condition);
				rewardsPerCondition[reward.condition] = rewardsPerCondition[reward.condition] || [];
				rewardsPerCondition[reward.condition].push(reward.id);
			});

			db.setAdd('conditions:active', conditions, next);
		},
		function (next) {
			async.each(Object.keys(rewardsPerCondition), function (condition, next) {
				db.setAdd('condition:' + condition + ':rewards', rewardsPerCondition[condition], next);
			}, next);
		},
	], function (err) {
		callback(err);
	});
}

function getActiveRewards(callback) {
	var activeRewards = [];

	function load(id, next) {
		async.parallel({
			main: function (next) {
				db.getObject('rewards:id:' + id, next);
			},
			rewards: function (next) {
				db.getObject('rewards:id:' + id + ':rewards', next);
			},
		}, function (err, data) {
			if (data.main) {
				data.main.disabled = data.main.disabled === 'true';
				data.main.rewards = data.rewards;
				activeRewards.push(data.main);
			}

			next(err);
		});
	}

	db.getSetMembers('rewards:list', function (err, rewards) {
		if (err) {
			return callback(err);
		}

		async.eachSeries(rewards, load, function (err) {
			callback(err, activeRewards);
		});
	});
}

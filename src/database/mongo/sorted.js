"use strict";

module.exports = function(db, module) {
	var helpers = module.helpers.mongo;

	module.sortedSetAdd = function(key, score, value, callback) {
		value = helpers.valueToString(value);
		var data = {
			score: parseInt(score, 10),
			value: value
		};

		db.collection('objects').update({_key:key, value:value}, {$set:data}, {upsert:true, w: 1}, helpers.done(callback));
	};

	module.sortedSetRemove = function(key, value, callback) {
		value = helpers.valueToString(value);

		db.collection('objects').remove({_key:key, value:value}, helpers.done(callback));
	};

	function getSortedSetRange(key, start, stop, sort, withScores, callback) {
		db.collection('objects').find({_key:key}, {fields: {_id: 0, value: 1, score: 1}})
			.limit(stop - start + 1)
			.skip(start)
			.sort({score: sort})
			.toArray(function(err, data) {
				if (err || !data) {
					return callback(err, null);
				}

				if (!withScores) {
					data = data.map(function(item) {
						return item.value;
					});
				}

				callback(null, data);
			});
	}

	module.getSortedSetRange = function(key, start, stop, callback) {
		getSortedSetRange(key, start, stop, 1, false, callback);
	};

	module.getSortedSetRevRange = function(key, start, stop, callback) {
		getSortedSetRange(key, start, stop, -1, false, callback);
	};

	module.getSortedSetRevRangeWithScores = function(key, start, stop, callback) {
		getSortedSetRange(key, start, stop, -1, true, callback)
	};

	module.getSortedSetRangeByScore = function(key, start, count, min, max, callback) {
		getSortedSetRangeByScore(key, start, count, min, max, 1, callback);
	};

	module.getSortedSetRevRangeByScore = function(key, start, count, max, min, callback) {
		getSortedSetRangeByScore(key, start, count, min, max, -1, callback);
	};

	function getSortedSetRangeByScore(key, start, count, min, max, sort, callback) {
		if(parseInt(count, 10) === -1) {
			count = 0;
		}

		db.collection('objects').find({_key:key, score: {$gte:min, $lte:max}}, {fields:{value:1}})
			.limit(count)
			.skip(start)
			.sort({score: sort})
			.toArray(function(err, data) {
				if(err) {
					return callback(err);
				}

				data = data.map(function(item) {
					return item.value;
				});

				callback(err, data);
			});
	}

	module.sortedSetCount = function(key, min, max, callback) {
		db.collection('objects').count({_key:key, score: {$gte:min, $lte:max}}, function(err, count) {
			callback(err, count ? count : 0);
		});
	};

	module.sortedSetCard = function(key, callback) {
		db.collection('objects').count({_key:key}, function(err, count) {
			callback(err, count ? count : 0);
		});
	};

	module.sortedSetRank = function(key, value, callback) {
		getSortedSetRank(module.getSortedSetRange, key, value, callback);
	};

	module.sortedSetRevRank = function(key, value, callback) {
		getSortedSetRank(module.getSortedSetRevRange, key, value, callback);
	};

	function getSortedSetRank(method, key, value, callback) {
		value = helpers.valueToString(value);
		method(key, 0, -1, function(err, result) {
			if(err) {
				return callback(err);
			}

			var rank = result.indexOf(value);
			callback(null, rank !== -1 ? rank : null);
		});
	}

	module.sortedSetScore = function(key, value, callback) {
		value = helpers.valueToString(value);
		db.collection('objects').findOne({_key:key, value: value}, {fields:{score:1}}, function(err, result) {
			callback(err, result ? result.score : null);
		});
	};

	module.isSortedSetMember = function(key, value, callback) {
		module.sortedSetScore(key, value, function(err, score) {
			callback(err, !!score);
		});
	};

	module.sortedSetsScore = function(keys, value, callback) {
		value = helpers.valueToString(value);
		db.collection('objects').find({_key:{$in:keys}, value: value}).toArray(function(err, result) {
			if(err) {
				return callback(err);
			}

			var returnData = [],
				item;

			for(var i=0; i<keys.length; ++i) {
				item = helpers.findItem(result, keys[i]);
				returnData.push(item ? item.score : null);
			}

			callback(null, returnData);
		});
	};
};
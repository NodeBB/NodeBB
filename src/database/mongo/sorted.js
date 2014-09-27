"use strict";

var async = require('async');

module.exports = function(db, module) {
	var helpers = module.helpers.mongo;

	module.sortedSetAdd = function(key, score, value, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		if (Array.isArray(score) && Array.isArray(value)) {
			return sortedSetAddBulk(key, score, value, callback);
		}

		value = helpers.valueToString(value);
		var data = {
			score: parseInt(score, 10),
			value: value
		};

		db.collection('objects').update({_key: key, value: value}, {$set: data}, {upsert:true, w: 1}, function(err) {
			callback(err);
		});
	};

	function sortedSetAddBulk(key, scores, values, callback) {
		if (scores.length !== values.length) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		values = values.map(helpers.valueToString);

		var bulk = db.collection('objects').initializeUnorderedBulkOp();

		for(var i=0; i<scores.length; ++i) {
			bulk.find({_key: key, value: values[i]}).upsert().updateOne({$set: {score: scores[i], value: values[i]}});
		}

		bulk.execute(function(err, result) {
			callback(err);
		});
	}

	module.sortedSetsAdd = function(keys, score, value, callback) {
		callback = callback || helpers.noop;
		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}
		value = helpers.valueToString(value);
		var data = {
			score: parseInt(score, 10),
			value: value
		};

		var bulk = db.collection('objects').initializeUnorderedBulkOp();

		for(var i=0; i<keys.length; ++i) {
			bulk.find({_key: keys[i], value: value}).upsert().updateOne({$set: data});
		}

		bulk.execute(function(err, result) {
			callback(err);
		});
	};

	module.sortedSetRemove = function(key, value, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		if (!Array.isArray(value)) {
			value = [value];
		}
		value = value.map(helpers.valueToString);

		db.collection('objects').remove({_key: key, value: {$in: value}}, function(err) {
			callback(err);
		});
	};

	module.sortedSetsRemove = function(keys, value, callback) {
		callback = callback || helpers.noop;
		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}
		value = helpers.valueToString(value);

		db.collection('objects').remove({_key: {$in: keys}, value: value}, callback);
	};

	module.sortedSetsRemoveRangeByScore = function(keys, min, max, callback) {
		callback = callback || helpers.noop;
		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}
		db.collection('objects').remove({_key: {$in: keys}, score: {$lte: max, $gte: min}}, function(err) {
			callback(err);
		});
	};

	function getSortedSetRange(key, start, stop, sort, withScores, callback) {
		if (!key) {
			return callback();
		}

		var fields = {_id: 0, value: 1};
		if (withScores) {
			fields['score'] = 1;
		}
		db.collection('objects').find({_key:key}, {fields: fields})
			.limit(stop - start + 1)
			.skip(start)
			.sort({score: sort})
			.toArray(function(err, data) {
				if (err || !data) {
					return callback(err);
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
		getSortedSetRange(key, start, stop, -1, true, callback);
	};

	module.getSortedSetRangeByScore = function(key, start, count, min, max, callback) {
		getSortedSetRangeByScore(key, start, count, min, max, 1, false, callback);
	};

	module.getSortedSetRevRangeByScore = function(key, start, count, max, min, callback) {
		getSortedSetRangeByScore(key, start, count, min, max, -1, false, callback);
	};

	module.getSortedSetRevRangeByScoreWithScores = function(key, start, count, max, min, callback) {
		getSortedSetRangeByScore(key, start, count, min, max, -1, true, callback);
	};

	function getSortedSetRangeByScore(key, start, count, min, max, sort, withScores, callback) {
		if (!key) {
			return callback();
		}
		if(parseInt(count, 10) === -1) {
			count = 0;
		}

		var scoreQuery = {};
		if (min !== -Infinity) {
			scoreQuery['$gte'] = min;
		}
		if (max !== Infinity) {
			scoreQuery['$lte'] = max;
		}

		var fields = {_id: 0, value: 1};
		if (withScores) {
			fields['score'] = 1;
		}

		db.collection('objects').find({_key:key, score: scoreQuery}, {fields: fields})
			.limit(count)
			.skip(start)
			.sort({score: sort})
			.toArray(function(err, data) {
				if(err) {
					return callback(err);
				}

				if (!withScores) {
					data = data.map(function(item) {
						return item.value;
					});
				}

				callback(err, data);
			});
	}

	module.sortedSetCount = function(key, min, max, callback) {
		if (!key) {
			return callback();
		}
		db.collection('objects').count({_key: key, score: {$gte: min, $lte: max}}, function(err, count) {
			callback(err, count ? count : 0);
		});
	};

	module.sortedSetCard = function(key, callback) {
		if (!key) {
			return callback();
		}
		db.collection('objects').count({_key: key}, function(err, count) {
			count = parseInt(count, 10);
			callback(err, count ? count : 0);
		});
	};

	module.sortedSetsCard = function(keys, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}
		var pipeline = [
			{ $match : { _key : { $in: keys } } } ,
			{ $group: { _id: {_key: '$_key'}, count: { $sum: 1 } } },
			{ $project: { _id: 1, count: '$count' } }
		];
		db.collection('objects').aggregate(pipeline, function(err, results) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(results)) {
				results = [];
			}

			var map = {};
			results.forEach(function(item) {
				if (item && item._id._key) {
					map[item._id._key] = item.count;
				}
			});

			results = keys.map(function(key) {
				return map[key] || 0;
			});
			callback(null, results);
		});
	};

	module.sortedSetRank = function(key, value, callback) {
		getSortedSetRank(module.getSortedSetRange, key, value, callback);
	};

	module.sortedSetRevRank = function(key, value, callback) {
		getSortedSetRank(module.getSortedSetRevRange, key, value, callback);
	};

	function getSortedSetRank(method, key, value, callback) {
		if (!key) {
			return callback();
		}
		value = helpers.valueToString(value);
		method(key, 0, -1, function(err, result) {
			if(err) {
				return callback(err);
			}

			var rank = result.indexOf(value);
			callback(null, rank !== -1 ? rank : null);
		});
	}

	module.sortedSetsRanks = function(keys, values, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback(null, []);
		}
		var data = new Array(values.length);
		for (var i=0; i<values.length; ++i) {
			data[i] = {key: keys[i], value: values[i]};
		}

		async.map(data, function(item, next) {
			getSortedSetRank(module.getSortedSetRange, item.key, item.value, next);
		}, callback);
	};

	module.sortedSetRanks = function(key, values, callback) {
		module.getSortedSetRange(key, 0, -1, function(err, sortedSet) {
			if (err) {
				return callback(err);
			}

			var result = values.map(function(value) {
				var index = sortedSet.indexOf(value.toString());
				return index !== -1 ? index : null;
			});

			callback(null, result);
		});
	};

	module.sortedSetScore = function(key, value, callback) {
		if (!key) {
			return callback();
		}
		value = helpers.valueToString(value);
		db.collection('objects').findOne({_key:key, value: value}, {fields:{score: 1}}, function(err, result) {
			callback(err, result ? result.score : null);
		});
	};

	module.sortedSetsScore = function(keys, value, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}
		value = helpers.valueToString(value);
		db.collection('objects').find({_key:{$in:keys}, value: value}).toArray(function(err, result) {
			if (err) {
				return callback(err);
			}

			var map = helpers.toMap(result),
				returnData = [],
				item;

			for(var i=0; i<keys.length; ++i) {
				item = map[keys[i]];
				returnData.push(item ? item.score : null);
			}

			callback(null, returnData);
		});
	};

	module.sortedSetScores = function(key, values, callback) {
		if (!key) {
			return callback();
		}
		values = values.map(helpers.valueToString);
		db.collection('objects').find({_key: key, value: {$in: values}}).toArray(function(err, result) {
			if (err) {
				return callback(err);
			}

			var map = {};
			result.forEach(function(item) {
				map[item.value] = item.score;
			});

			var	returnData = new Array(values.length),
				score;

			for(var i=0; i<values.length; ++i) {
				score = map[values[i]];
				returnData[i] = score ? score : null;
			}

			callback(null, returnData);
		});
	};

	module.isSortedSetMember = function(key, value, callback) {
		module.sortedSetScore(key, value, function(err, score) {
			callback(err, !!score);
		});
	};

	module.isSortedSetMembers = function(key, values, callback) {
		if (!key) {
			return callback();
		}
		values = values.map(helpers.valueToString);
		db.collection('objects').find({_key: key, value: {$in: values}}).toArray(function(err, results) {
			if (err) {
				return callback(err);
			}

			results = results.map(function(item) {
				return item.value;
			});

			values = values.map(function(value) {
				return results.indexOf(value) !== -1;
			});
			callback(null, values);
		});
	};

	module.getSortedSetUnion = function(sets, start, stop, callback) {
		getSortedSetUnion(sets, 1, start, stop, callback);
	};

	module.getSortedSetRevUnion = function(sets, start, stop, callback) {
		getSortedSetUnion(sets, -1, start, stop, callback);
	};

	function getSortedSetUnion(sets, sort, start, stop, callback) {
		if (!Array.isArray(sets) || !sets.length) {
			return callback();
		}
		var limit = stop - start + 1;
		if (limit <= 0) {
			limit = 0;
		}

		var pipeline = [
			{ $match: { _key: {$in: sets}} },
			{ $group: { _id: {value: '$value'}, totalScore: {$sum : "$score"}} },
			{ $sort: { totalScore: sort} }
		];

		if (start) {
			pipeline.push({ $skip: start });
		}

		if (limit > 0) {
			pipeline.push({ $limit: limit });
		}

		pipeline.push({	$project: { _id: 0, value: '$_id.value' }});

		db.collection('objects').aggregate(pipeline, function(err, data) {
			if (err || !data) {
				return callback(err);
			}

			data = data.map(function(item) {
				return item.value;
			});
			callback(null, data);
		});
	}

	module.sortedSetIncrBy = function(key, increment, value, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		var data = {};
		value = helpers.fieldToString(value);
		data['score'] = parseInt(increment, 10);

		db.collection('objects').findAndModify({_key: key, value: value}, {}, {$inc: data}, {new:true, upsert:true}, function(err, result) {
			callback(err, result ? result[value] : null);
		});
	};
};
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

		db.collection('objects').update({_key: key, value: value}, {$set: {score: parseInt(score, 10)}}, {upsert:true, w: 1}, function(err) {
			callback(err);
		});
	};

	function sortedSetAddBulk(key, scores, values, callback) {
		if (!scores.length || !values.length) {
			return callback();
		}
		if (scores.length !== values.length) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		values = values.map(helpers.valueToString);

		var bulk = db.collection('objects').initializeUnorderedBulkOp();

		for(var i=0; i<scores.length; ++i) {
			bulk.find({_key: key, value: values[i]}).upsert().updateOne({$set: {score: parseInt(scores[i], 10)}});
		}

		bulk.execute(function(err) {
			callback(err);
		});
	}

	module.sortedSetsAdd = function(keys, score, value, callback) {
		callback = callback || helpers.noop;
		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}
		value = helpers.valueToString(value);

		var bulk = db.collection('objects').initializeUnorderedBulkOp();

		for(var i=0; i<keys.length; ++i) {
			bulk.find({_key: keys[i], value: value}).upsert().updateOne({$set: {score: parseInt(score, 10)}});
		}

		bulk.execute(function(err) {
			callback(err);
		});
	};

	module.sortedSetRemove = function(key, value, callback) {
		function done(err) {
			callback(err);
		}
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}

		if (Array.isArray(value)) {
			value = value.map(helpers.valueToString);
			db.collection('objects').remove({_key: key, value: {$in: value}}, done);
		} else {
			value = helpers.valueToString(value);
			db.collection('objects').remove({_key: key, value: value}, done);
		}
	};

	module.sortedSetsRemove = function(keys, value, callback) {
		callback = callback || helpers.noop;
		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}
		value = helpers.valueToString(value);

		db.collection('objects').remove({_key: {$in: keys}, value: value}, function(err) {
			callback(err);
		});
	};

	module.sortedSetsRemoveRangeByScore = function(keys, min, max, callback) {
		callback = callback || helpers.noop;
		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}
		var query = {_key: {$in: keys}};

		if (min !== '-inf') {
			query.score = {$gte: min};
		}
		if (max !== '+inf') {
			query.score = query.score || {};
			query.score.$lte = max;
		}

		db.collection('objects').remove(query, function(err) {
			callback(err);
		});
	};

	module.getSortedSetRange = function(key, start, stop, callback) {
		getSortedSetRange(key, start, stop, 1, false, callback);
	};

	module.getSortedSetRevRange = function(key, start, stop, callback) {
		getSortedSetRange(key, start, stop, -1, false, callback);
	};

	module.getSortedSetRangeWithScores = function(key, start, stop, callback) {
		getSortedSetRange(key, start, stop, 1, true, callback);
	};

	module.getSortedSetRevRangeWithScores = function(key, start, stop, callback) {
		getSortedSetRange(key, start, stop, -1, true, callback);
	};

	function getSortedSetRange(key, start, stop, sort, withScores, callback) {
		if (!key) {
			return callback();
		}

		var fields = {_id: 0, value: 1};
		if (withScores) {
			fields.score = 1;
		}

		if (Array.isArray(key)) {
			key = {$in: key};
		}

		db.collection('objects').find({_key: key}, {fields: fields})
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

	module.getSortedSetRangeByScore = function(key, start, count, min, max, callback) {
		getSortedSetRangeByScore(key, start, count, min, max, 1, false, callback);
	};

	module.getSortedSetRevRangeByScore = function(key, start, count, max, min, callback) {
		getSortedSetRangeByScore(key, start, count, min, max, -1, false, callback);
	};

	module.getSortedSetRangeByScoreWithScores = function(key, start, count, min, max, callback) {
		getSortedSetRangeByScore(key, start, count, min, max, 1, true, callback);
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

		var query = {_key: key};

		if (min !== '-inf') {
			query.score = {$gte: min};
		}
		if (max !== '+inf') {
			query.score = query.score || {};
			query.score.$lte = max;
		}

		var fields = {_id: 0, value: 1};
		if (withScores) {
			fields.score = 1;
		}

		db.collection('objects').find(query, {fields: fields})
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

		var query = {_key: key};
		if (min !== '-inf') {
			query.score = {$gte: min};
		}
		if (max !== '+inf') {
			query.score = query.score || {};
			query.score.$lte = max;
		}

		db.collection('objects').count(query, function(err, count) {
			callback(err, count ? count : 0);
		});
	};

	module.sortedSetCard = function(key, callback) {
		if (!key) {
			return callback(null, 0);
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
				if (!value) {
					return null;
				}
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
		db.collection('objects').findOne({_key: key, value: value}, {fields:{_id: 0, score: 1}}, function(err, result) {
			callback(err, result ? result.score : null);
		});
	};

	module.sortedSetsScore = function(keys, value, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}
		value = helpers.valueToString(value);
		db.collection('objects').find({_key:{$in:keys}, value: value}, {_id:0, _key:1, score: 1}).toArray(function(err, result) {
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
		db.collection('objects').find({_key: key, value: {$in: values}}, {_id: 0, value: 1, score: 1}).toArray(function(err, result) {
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
		if (!key) {
			return callback();
		}
		value = helpers.valueToString(value);
		db.collection('objects').findOne({_key: key, value: value}, {_id: 0, value: 1}, function(err, result) {
			callback(err, !!result);
		});
	};

	module.isSortedSetMembers = function(key, values, callback) {
		if (!key) {
			return callback();
		}
		values = values.map(helpers.valueToString);
		db.collection('objects').find({_key: key, value: {$in: values}}, {fields: {_id: 0, value: 1}}).toArray(function(err, results) {
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

	module.isMemberOfSortedSets = function(keys, value, callback) {
		if (!Array.isArray(keys)) {
			return callback();
		}
		value = helpers.valueToString(value);
		db.collection('objects').find({_key: {$in: keys}, value: value}, {fields: {_id: 0, _key: 1, value: 1}}).toArray(function(err, results) {
			if (err) {
				return callback(err);
			}

			results = results.map(function(item) {
				return item._key;
			});

			results = keys.map(function(key) {
				return results.indexOf(key) !== -1;
			});
			callback(null, results);
		});
	};

	module.getSortedSetsMembers = function(keys, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback(null, []);
		}
		db.collection('objects').find({_key: {$in: keys}}, {_id: 0, _key: 1, value: 1}).toArray(function(err, data) {
			if (err) {
				return callback(err);
			}

			var sets = {};
			data.forEach(function(set) {
			 	sets[set._key] = sets[set._key] || [];
			 	sets[set._key].push(set.value);
			});

			var returnData = new Array(keys.length);
			for(var i=0; i<keys.length; ++i) {
			 	returnData[i] = sets[keys[i]] || [];
			}
			callback(null, returnData);
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
		data.score = parseInt(increment, 10);

		db.collection('objects').findAndModify({_key: key, value: value}, {}, {$inc: data}, {new: true, upsert: true}, function(err, result) {
			// if there is duplicate key error retry the upsert
			// https://github.com/NodeBB/NodeBB/issues/4467
			// https://jira.mongodb.org/browse/SERVER-14322
			// https://docs.mongodb.org/manual/reference/command/findAndModify/#upsert-and-unique-index
			if (err && err.message.startsWith('E11000 duplicate key error')) {
				return module.sortedSetIncrBy(key, increment, value, callback);
			}
			callback(err, result && result.value ? result.value.score : null);
		});
	};

	module.getSortedSetRangeByLex = function(key, min, max, start, count, callback) {
		var query = {_key: key};
		if (min !== '-') {
			query.value = {$gte: min};
		}
		if (max !== '+') {
			query.value = query.value || {};
			query.value.$lte = max;
		}
		db.collection('objects').find(query, {_id: 0, value: 1})
			.sort({value: 1})
			.skip(start)
			.limit(count === -1 ? 0 : count)
			.toArray(function(err, data) {
				if (err) {
					return callback(err);
				}
				data = data.map(function(item) {
					return item && item.value;
				});
				callback(err, data);
		});
	};

	module.processSortedSet = function(setKey, process, batch, callback) {
		var done = false;
		var ids = [];
		var cursor = db.collection('objects').find({_key: setKey})
			.sort({score: 1})
			.project({_id: 0, value: 1})
			.batchSize(batch);

		async.whilst(
			function() {
				return !done;
			},
			function(next) {
				cursor.next(function(err, item) {
					if (err) {
						return next(err);
					}
					if (item === null) {
						done = true;
					} else {
						ids.push(item.value);
					}

					if (ids.length < batch && (!done || ids.length === 0)) {
						return next(null);
					}

					process(ids, function(err) {
						ids = [];
						return next(err);
					});
				});
			},
			callback
		);
	};
};

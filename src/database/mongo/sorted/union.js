'use strict';

module.exports = function (db, module) {
	module.sortedSetUnionCard = function (keys, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback(null, 0);
		}

		var pipeline = [
			{ $match: { _key: { $in: keys } } },
			{ $group: { _id: { value: '$value' } } },
			{ $group: { _id: null, count: { $sum: 1 } } },
		];

		var project = { _id: 0, count: '$count' };
		pipeline.push({	$project: project });

		db.collection('objects').aggregate(pipeline).toArray(function (err, data) {
			callback(err, Array.isArray(data) && data.length ? data[0].count : 0);
		});
	};

	module.getSortedSetUnion = function (params, callback) {
		params.sort = 1;
		getSortedSetUnion(params, callback);
	};

	module.getSortedSetRevUnion = function (params, callback) {
		params.sort = -1;
		getSortedSetUnion(params, callback);
	};

	function getSortedSetUnion(params, callback) {
		if (!Array.isArray(params.sets) || !params.sets.length) {
			return callback();
		}
		var limit = params.stop - params.start + 1;
		if (limit <= 0) {
			limit = 0;
		}

		var aggregate = {};
		if (params.aggregate) {
			aggregate['$' + params.aggregate.toLowerCase()] = '$score';
		} else {
			aggregate.$sum = '$score';
		}

		var pipeline = [
			{ $match: { _key: { $in: params.sets } } },
			{ $group: { _id: { value: '$value' }, totalScore: aggregate } },
			{ $sort: { totalScore: params.sort } },
		];

		if (params.start) {
			pipeline.push({ $skip: params.start });
		}

		if (limit > 0) {
			pipeline.push({ $limit: limit });
		}

		var project = { _id: 0, value: '$_id.value' };
		if (params.withScores) {
			project.score = '$totalScore';
		}
		pipeline.push({	$project: project });

		db.collection('objects').aggregate(pipeline).toArray(function (err, data) {
			if (err || !data) {
				return callback(err);
			}

			if (!params.withScores) {
				data = data.map(function (item) {
					return item.value;
				});
			}

			callback(null, data);
		});
	}
};

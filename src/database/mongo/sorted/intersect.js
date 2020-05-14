'use strict';

const utils = require('../../../utils');

module.exports = function (module) {
	module.sortedSetIntersectCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return 0;
		}
		const match = { _key: { $in: keys } };
		await buildValueQuery(match, keys);
		var pipeline = [
			{ $match: match },
			{ $group: { _id: { value: '$value' }, count: { $sum: 1 } } },
			{ $match: { count: keys.length } },
			{ $group: { _id: null, count: { $sum: 1 } } },
		];

		const data = await module.client.collection('objects')
			.aggregate(pipeline, { collation: { locale: 'en_US', numericOrdering: true } })
			.toArray();
		return Array.isArray(data) && data.length ? data[0].count : 0;
	};

	module.getSortedSetIntersect = async function (params) {
		params.sort = 1;
		return await getSortedSetRevIntersect(params);
	};

	module.getSortedSetRevIntersect = async function (params) {
		params.sort = -1;
		return await getSortedSetRevIntersect(params);
	};

	async function getSortedSetRevIntersect(params) {
		var sets = params.sets;
		var start = params.hasOwnProperty('start') ? params.start : 0;
		var stop = params.hasOwnProperty('stop') ? params.stop : -1;
		var weights = params.weights || [];
		var aggregate = {};

		if (params.aggregate) {
			aggregate['$' + params.aggregate.toLowerCase()] = '$score';
		} else {
			aggregate.$sum = '$score';
		}

		var limit = stop - start + 1;
		if (limit <= 0) {
			limit = 0;
		}

		const match = { _key: { $in: sets } };
		await buildValueQuery(match, sets);

		var pipeline = [{ $match: match }];

		weights.forEach(function (weight, index) {
			if (weight !== 1) {
				pipeline.push({
					$project: {
						value: 1,
						score: {
							$cond: {
								if: {
									$eq: ['$_key', sets[index]],
								},
								then: {
									$multiply: ['$score', weight],
								},
								else: '$score',
							},
						},
					},
				});
			}
		});

		pipeline.push({ $group: { _id: { value: '$value' }, totalScore: aggregate, count: { $sum: 1 } } });
		pipeline.push({ $match: { count: sets.length } });
		pipeline.push({ $sort: { totalScore: params.sort } });

		if (start) {
			pipeline.push({ $skip: start });
		}

		if (limit > 0) {
			pipeline.push({ $limit: limit });
		}

		var project = { _id: 0, value: '$_id.value' };
		if (params.withScores) {
			project.score = '$totalScore';
		}
		pipeline.push({ $project: project });
		let data = await module.client.collection('objects')
			.aggregate(pipeline, { collation: { locale: 'en_US', numericOrdering: true } })
			.toArray();
		if (!params.withScores) {
			data = data.map(item => item.value);
		}
		return data;
	}

	async function buildValueQuery(match, sets) {
		async function query(set, sort) {
			const data = await module.client.collection('objects')
				.find({ _key: set }, { projection: { _id: 0, _key: 0, score: 0 } })
				.collation({ locale: 'en_US', numericOrdering: true })
				.sort({ value: sort })
				.limit(1)
				.toArray();
			return data && data.length ? data[0].value : null;
		}
		const bounds = await Promise.all(sets.map(async (s) => {
			var u = await query(s, -1);
			var l = await query(s, 1);
			return { u: u, l: l };
		}));

		let lowerBound = bounds[0].l;
		let upperBound = bounds[0].u;

		for (let i = 1; i < bounds.length; i++) {
			if (utils.isNumber(upperBound) && utils.isNumber(bounds[i].u)) {
				upperBound = Math.min(upperBound, bounds[i].u);
			} else {
				upperBound = upperBound < bounds[i].u ? upperBound : bounds[i].u;
			}
			if (utils.isNumber(lowerBound) && utils.isNumber(bounds[i].l)) {
				lowerBound = Math.max(lowerBound, bounds[i].l);
			} else {
				lowerBound = lowerBound > bounds[i].l ? lowerBound : bounds[i].l;
			}
		}

		if (lowerBound) {
			match.value = { $gte: String(lowerBound) };
		}
		if (upperBound) {
			match.value = match.value || {};
			match.value.$lte = String(upperBound);
		}
	}
};

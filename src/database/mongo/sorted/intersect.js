'use strict';

module.exports = function (module) {
	module.sortedSetIntersectCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return 0;
		}
		const items = await getIntersectionItems(keys);
		return items.length;
	};

	async function getIntersectionItems(sets) {
		const objects = module.client.collection('objects');
		const counts = await Promise.all(
			sets.map(s => objects.countDocuments({ _key: s }, { limit: 50000 }))
		);
		const minCount = Math.min(...counts);
		if (minCount === 0) {
			return [];
		}
		const index = counts.indexOf(minCount);
		const smallestSet = sets[index];
		let items = await objects.find({ _key: smallestSet }, {
			projection: { _id: 0, value: 1 },
		}).toArray();

		items = items.map(v => v.value);
		const otherSets = sets.filter(s => s !== smallestSet);
		const isMembers = await Promise.all(otherSets.map(s => module.isSortedSetMembers(s, items)));
		return items.filter((item, idx) => isMembers.every(arr => arr[idx]));
	}

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

		if (weights.filter(w => w > 0).length === 1 && limit !== 0) {
			const items = await getIntersectionItems(sets);
			if (!items.length) {
				return [];
			}

			const project = { _id: 0, value: 1 };
			if (params.withScores) {
				project.score = 1;
			}
			const sortSet = sets[weights.indexOf(1)];
			let res = await module.client.collection('objects')
				.find({ _key: sortSet, value: { $in: items } }, project)
				.sort({ score: params.sort })
				.skip(start)
				.limit(limit)
				.toArray();
			if (!params.withScores) {
				res = res.map(i => i.value);
			}
			return res;
		}

		var pipeline = [{ $match: { _key: { $in: sets } } }];

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

		let data = await module.client.collection('objects').aggregate(pipeline).toArray();

		if (!params.withScores) {
			data = data.map(item => item.value);
		}
		return data;
	}
};

'use strict';

module.exports = function (module) {
	module.sortedSetIntersectCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return 0;
		}
		const objects = module.client.collection('objects');
		const counts = await countSets(keys, 50000);
		if (counts.minCount === 0) {
			return 0;
		}
		let items = await objects.find({ _key: counts.smallestSet }, {
			projection: { _id: 0, value: 1 },
		}).toArray();

		items = items.map(i => i.value);
		const otherSets = keys.filter(s => s !== counts.smallestSet);
		if (otherSets.length === 1) {
			return await objects.countDocuments({
				_key: otherSets[0], value: { $in: items },
			});
		}
		items = await intersectValuesWithSets(items, otherSets);
		return items.length;
	};

	async function intersectValuesWithSets(items, sets) {
		for (let i = 0; i < sets.length; i++) {
			/* eslint-disable no-await-in-loop */
			items = await module.client.collection('objects').find({
				_key: sets[i], value: { $in: items },
			}, {
				projection: { _id: 0, value: 1 },
			}).toArray();
			items = items.map(i => i.value);
		}
		return items;
	}

	async function countSets(sets, limit) {
		const objects = module.client.collection('objects');
		const counts = await Promise.all(
			sets.map(s => objects.countDocuments({ _key: s }, {
				limit: limit || 25000,
			}))
		);
		const minCount = Math.min(...counts);
		const index = counts.indexOf(minCount);
		const smallestSet = sets[index];
		return {
			minCount: minCount,
			smallestSet: smallestSet,
		};
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
		params.start = params.hasOwnProperty('start') ? params.start : 0;
		params.stop = params.hasOwnProperty('stop') ? params.stop : -1;
		params.weights = params.weights || [];

		params.limit = params.stop - params.start + 1;
		if (params.limit <= 0) {
			params.limit = 0;
		}
		params.counts = await countSets(params.sets);
		if (params.counts.minCount === 0) {
			return [];
		}

		const simple = params.weights.filter(w => w === 1).length === 1 && params.limit !== 0;
		if (params.counts.minCount < 25000 && simple) {
			return await intersectSingle(params);
		} else if (simple) {
			return await intersectBatch(params);
		}
		return await intersectAggregate(params);
	}

	async function intersectSingle(params) {
		const objects = module.client.collection('objects');
		let items = await objects.find({ _key: params.counts.smallestSet }, {
			projection: { _id: 0, value: 1 },
		}).toArray();
		if (!items.length) {
			return [];
		}

		const otherSets = params.sets.filter(s => s !== params.counts.smallestSet);
		items = await intersectValuesWithSets(items.map(i => i.value), otherSets);
		if (!items.length) {
			return [];
		}
		const project = { _id: 0, value: 1 };
		if (params.withScores) {
			project.score = 1;
		}
		const sortSet = params.sets[params.weights.indexOf(1)];
		let res = await objects
			.find({ _key: sortSet, value: { $in: items } }, { projection: project })
			.sort({ score: params.sort })
			.skip(params.start)
			.limit(params.limit)
			.toArray();
		if (!params.withScores) {
			res = res.map(i => i.value);
		}
		return res;
	}

	async function intersectBatch(params) {
		const project = { _id: 0, value: 1 };
		if (params.withScores) {
			project.score = 1;
		}
		const sortSet = params.sets[params.weights.indexOf(1)];
		const batchSize = 10000;
		const cursor = await module.client.collection('objects')
			.find({ _key: sortSet }, { projection: project })
			.sort({ score: params.sort })
			.batchSize(batchSize);

		const otherSets = params.sets.filter(s => s !== sortSet);
		let inters = [];
		let done = false;
		while (!done) {
			/* eslint-disable no-await-in-loop */
			const items = [];
			while (items.length < batchSize) {
				const nextItem = await cursor.next();
				if (!nextItem) {
					done = true;
					break;
				}
				items.push(nextItem);
			}

			const members = await Promise.all(otherSets.map(s => module.isSortedSetMembers(s, items.map(i => i.value))));
			inters = inters.concat(items.filter((item, idx) => members.every(arr => arr[idx])));
			if (inters.length >= params.stop) {
				done = true;
				inters = inters.slice(params.start, params.stop + 1);
			}
		}
		if (!params.withScores) {
			inters = inters.map(item => item.value);
		}
		return inters;
	}

	async function intersectAggregate(params) {
		var aggregate = {};

		if (params.aggregate) {
			aggregate['$' + params.aggregate.toLowerCase()] = '$score';
		} else {
			aggregate.$sum = '$score';
		}
		const pipeline = [{ $match: { _key: { $in: params.sets } } }];

		params.weights.forEach(function (weight, index) {
			if (weight !== 1) {
				pipeline.push({
					$project: {
						value: 1,
						score: {
							$cond: {
								if: {
									$eq: ['$_key', params.sets[index]],
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
		pipeline.push({ $match: { count: params.sets.length } });
		pipeline.push({ $sort: { totalScore: params.sort } });

		if (params.start) {
			pipeline.push({ $skip: params.start });
		}

		if (params.limit > 0) {
			pipeline.push({ $limit: params.limit });
		}

		const project = { _id: 0, value: '$_id.value' };
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

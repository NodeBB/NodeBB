'use strict';

module.exports = function (module) {
	module.sortedSetIntersectCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return 0;
		}
		const objects = module.client.getCollection('objects');
		const counts = await countSets(keys, 50000);
		if (counts.minCount === 0) {
			return 0;
		}
		let items = await objects.findMany({
			filter: { _key: counts.smallestSet },
			fields: { include: ['value'] },
		}).toArray();
		items = items.slice(0, counts.minCount + 1);

		const otherSets = keys.filter(s => s !== counts.smallestSet);
		for (let i = 0; i < otherSets.length; i++) {
			/* eslint-disable no-await-in-loop */
			const query = items.length === 1 ? { _key: otherSets[i], value: items[0].value } : {
				$or: items.map(i => ({ _key: otherSets[i], value: i.value })),
			};
			if (i === otherSets.length - 1) {
				return (await objects.findMany({
					filter: query,
				}).toArray()).length;
			}
			const { length } = items;
			items = await objects.findMany({
				filter: query,
				fields: { include: ['value'] },
			}).toArray();
			items = items.slice(0, length + 1);
		}
	};

	async function countSets(sets, limit) {
		const objects = module.client.getCollection('objects');
		let counts = await Promise.all(
			sets.map(s => objects.findMany({
				filter: { _key: s },
				fields: { include: ['_key'] },
			})).toArray()
		);
		counts = counts.map(c => Math.min(c.length, limit || 25000));


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
		const { FindQueryOptions } = require('@tigrisdata/core');
		const objects = module.client.collection('objects');
		const sortSet = params.sets[params.weights.indexOf(1)];
		if (sortSet === params.counts.smallestSet) {
			return await intersectBatch(params);
		}

		let items = await objects.findMany({
			filter: { _key: params.counts.smallestSet },
			fields: { include: ['value'] },
		}).toArray();
		if (params.counts.minCount > 1) {
			items = items.slice(0, params.counts.minCount + 1);
		}

		const otherSets = params.sets.filter(s => s !== params.counts.smallestSet);
		// move sortSet to the end of array
		otherSets.push(otherSets.splice(otherSets.indexOf(sortSet), 1)[0]);
		for (let i = 0; i < otherSets.length; i++) {
			/* eslint-disable no-await-in-loop */
			const query = items.length === 1 ? { _key: otherSets[i], value: items[0].value } :
				{ $or: items.map(i => ({ _key: otherSets[i], value: i.value })) };
			const { length } = items;
			// at the last step sort by sortSet
			if (i === otherSets.length - 1) {
				items = await objects.findMany({
					filter: query,
					fields: { include: ['value', 'score'] },
					sort: { field: 'score', order: params.sort === 1 ? '$asc' : '$desc' },
					options: new FindQueryOptions(params.limit, params.skip),
				}).toArray();
			} else {
				items = await objects.findMany({
					filter: query,
					fields: { include: ['value'] },
				}).toArray();
			}
			items = items.slice(0, length + 1);
		}
		if (!params.withScores) {
			items = items.map(i => i.value);
		}
		return items;
	}

	async function intersectBatch(params) {
		const project = params.withScores ? ['value', 'score'] : ['value'];

		const sortSet = params.sets[params.weights.indexOf(1)];
		const batchSize = 10000;

		const cursor = await module.client.getCollection('objects')
			.findMany({
				filter: { _key: sortSet },
				fields: { include: project },
				sort: { field: 'score', order: params.sort === 1 ? '$asc' : '$desc' },
			});
		const cursorIterator = cursor[Symbol.asyncIterator]();
		const otherSets = params.sets.filter(s => s !== sortSet);
		let inters = [];
		let done = false;
		while (!done) {
			/* eslint-disable no-await-in-loop */
			const items = [];
			while (items.length < batchSize) {
				const next = await cursorIterator.next();
				const nextItem = next.value;
				done = next.done;
				if (done) {
					break;
				}
				items.push(nextItem);
			}

			const members = await Promise.all(otherSets.map(async (s) => {
				const data = (await module.client.getCollection('objects').findMany({
					filter: items.length === 1 ? { _key: s, value: items[0].value } :
						{ $or: items.map(i => ({ _key: s, value: i.value })) },
					fields: { include: ['value'] },
				}).toArray()).slice(0, items.length + 1);

				return new Set(data.map(i => i.value));
			}));

			inters = inters.concat(items.filter(item => members.every(arr => arr.has(item.value))));
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
		const objects = module.client.getCollection('objects');

		let data = (await objects.findMany({
			filter: params.sets.length === 1 ? { _key: params.sets[0] } :
				{ $or: params.sets.map(k => ({ _key: k })) },
			fields: { include: ['value', 'score', '_key'] },
		}).toArray()).map((doc) => {
			const weight = params.weights[params.sets.indexOf(doc._key)];
			return { value: doc.value, score: doc.score * (weight || 1) };
		});

		const groups = {};

		data.forEach((doc) => {
			if (!groups[doc.value]) {
				groups[doc.value] = { count: 0, scores: [] };
			}
			groups[doc.value].count += 1;
			groups[doc.value].scores.push(doc.score);
		});

		data = Object.entries(groups)
			.filter(([value, group]) => group.count === params.sets.length)
			.map(([value, group]) => {
				let totalScore;
				if (params.aggregate) {
					if (params.aggregate.toLowerCase() === 'sum') {
						totalScore = group.scores.reduce((a, b) => a + b, 0);
					} else if (params.aggregate.toLowerCase() === 'avg') {
						totalScore = group.scores.reduce((a, b) => a + b, 0) / group.scores.length;
					} else if (params.aggregate.toLowerCase() === 'max') {
						totalScore = Math.max(...group.scores);
					} else if (params.aggregate.toLowerCase() === 'min') {
						totalScore = Math.min(...group.scores);
					}
				} else {
					totalScore = group.scores.reduce((a, b) => a + b, 0);
				}
				return { value, score: totalScore, totalScore };
			});

		data.sort((a, b) => (params.sort === 1 ? a.score - b.score : b.score - a.score));

		data = data.slice(params.start, params.start + params.limit);

		if (!params.withScores) {
			data = data.map(item => item.value);
		}

		return data;
	}
};

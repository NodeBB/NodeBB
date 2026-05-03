'use strict';

module.exports = function (module) {
	const { helpers } = module;

	module.sortedSetUnionCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return 0;
		}

		const result = await helpers.createZsetQuery()
			.select(eb => eb.fn.count(eb.fn('distinct', ['z.value'])).as('c'))
			.where('o._key', 'in', keys)
			.executeTakeFirst();

		return parseInt(result?.c || 0, 10);
	};

	module.getSortedSetUnion = async function (params) {
		params.sort = 1;
		return await getSortedSetUnion(params);
	};

	module.getSortedSetRevUnion = async function (params) {
		params.sort = -1;
		return await getSortedSetUnion(params);
	};

	module.sortedSetUnion = async function (params) {
		params.sort = (params.method === 'zrevrange' || params.method === 'zrevrangebyscore') ? -1 : 1;
		return await getSortedSetUnion(params);
	};

	// Aggregate union of weighted zsets in a single SQL pass:
	//   SELECT value, AGG(score * CASE _key WHEN k1 THEN w1 ... END) FROM ... GROUP BY value
	// Avoids materialising every row into JS for large zsets.
	async function getSortedSetUnion({ sets, weights = [], aggregate = 'SUM', sort, withScores, start = 0, stop = -1, min = '-inf', max = '+inf' }) {
		if (!sets?.length) {
			return [];
		}

		const aggFn = aggregate === 'MIN' ? 'min' : aggregate === 'MAX' ? 'max' : 'sum';
		const weightMap = helpers.createWeightMap(sets, weights);
		const weighted = eb => sets.slice(1).reduce(
			(c, k) => c.when('z._key', '=', k).then(helpers.getWeight(weightMap, k)),
			eb.case().when('z._key', '=', sets[0]).then(helpers.getWeight(weightMap, sets[0])),
		).end();

		let query = helpers.createZsetQuery()
			.select(['z.value'])
			.select(eb => eb.fn[aggFn](eb(eb.ref('z.score'), '*', weighted(eb))).as('score'))
			.where('o._key', 'in', sets)
			.groupBy('z.value')
			.orderBy('score', sort > 0 ? 'asc' : 'desc');

		query = helpers.applyScoreConditions(query, min, max);

		// Negative indices: fetch all + slice. Positive: LIMIT/OFFSET.
		if (start < 0 || stop < 0) {
			const all = await query.execute();
			const sliced = helpers.sliceWithNegativeIndices(all, start, stop);
			return withScores ?
				sliced.map(r => ({ value: r.value, score: parseFloat(r.score) })) :
				sliced.map(r => r.value);
		}

		const limit = stop - start + 1;
		if (limit > 0) {
			query = query.offset(start).limit(limit);
		}

		const rows = await query.execute();
		return withScores ?
			rows.map(r => ({ value: r.value, score: parseFloat(r.score) })) :
			rows.map(r => r.value);
	}
};

'use strict';

module.exports = function (module) {
	const { helpers } = module;

	module.sortedSetIntersectCard = async function (keys) {
		if (!keys?.length) {
			return 0;
		}

		// Count values that appear in every key: GROUP BY value HAVING COUNT(DISTINCT _key) = N
		const rows = await helpers.createZsetQuery()
			.select(['z.value'])
			.select(eb => eb.fn.count(eb.fn('distinct', ['z._key'])).as('c'))
			.where('o._key', 'in', keys)
			.groupBy('z.value')
			.execute();

		return rows.filter(({ c }) => parseInt(c, 10) === keys.length).length;
	};

	module.getSortedSetIntersect = async function (params) {
		params.sort = 1;
		return await getSortedSetIntersect(params);
	};

	module.getSortedSetRevIntersect = async function (params) {
		params.sort = -1;
		return await getSortedSetIntersect(params);
	};

	// Aggregate intersect of weighted zsets in a single SQL pass:
	//   SELECT value, AGG(score * CASE _key WHEN k1 THEN w1 ... END) FROM ...
	//   GROUP BY value HAVING COUNT(DISTINCT _key) = N
	async function getSortedSetIntersect({ sets, weights = [], aggregate = 'SUM', sort, withScores, start = 0, stop = -1 }) {
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
			.having(eb => eb(eb.fn.count(eb.fn('distinct', ['z._key'])), '=', sets.length))
			.orderBy('score', sort > 0 ? 'asc' : 'desc');

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

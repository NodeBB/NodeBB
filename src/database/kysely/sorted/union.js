'use strict';

module.exports = function (module) {
	const { helpers } = module;

	module.sortedSetUnionCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return 0;
		}

		const now = new Date().toISOString();

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', join =>
				join.onRef('o._key', '=', 'z._key')
					.on('o.type', '=', 'zset'))
			.select(eb => eb.fn.count(eb.fn('distinct', ['z.value'])).as('c'))
			.where('o._key', 'in', keys)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
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

	// Internal function called when array of keys is passed to range functions
	module.sortedSetUnion = async function (params) {
		const { method } = params;
		if (method === 'zrevrange' || method === 'zrevrangebyscore') {
			params.sort = -1;
		} else {
			params.sort = 1;
		}
		return await getSortedSetUnion(params);
	};

	async function getSortedSetUnion({ sets, weights = [], aggregate = 'SUM', sort, withScores, start = 0, stop = -1, min = '-inf', max = '+inf' }) {
		if (!sets?.length) {
			return [];
		}

		const limit = stop - start + 1 > 0 ? stop - start + 1 : null;
		const weightMap = helpers.createWeightMap(sets, weights);
		const now = new Date().toISOString();

		// For MySQL 4 / SQLite compatibility, we emulate weighted union with application logic
		let query = module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', join =>
				join.onRef('o._key', '=', 'z._key')
					.on('o.type', '=', 'zset'))
			.select(['o._key as k', 'z.value', 'z.score'])
			.where('o._key', 'in', sets)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]));

		// Apply score filtering if min/max provided
		if (min !== '-inf') {
			const minScore = parseFloat(min);
			query = query.where('z.score', '>=', minScore);
		}
		if (max !== '+inf') {
			const maxScore = parseFloat(max);
			query = query.where('z.score', '<=', maxScore);
		}

		const rows = await query.execute();

		// Build array using Map, then aggregate/sort/paginate
		const result = [...rows.reduce((acc, { k, value, score }) => {
			const prev = acc.get(value) || { value, scores: [] };
			return acc.set(value, { value, scores: [...prev.scores, parseFloat(score) * helpers.getWeight(weightMap, k)] });
		}, new Map()).values()]
			.map(({ value, scores }) => ({ value, score: helpers.aggregateScores(scores, aggregate) }))
			.sort((a, b) => (sort > 0 ? a.score - b.score : b.score - a.score))
			.slice(start, limit ? start + limit : undefined);

		return withScores ? result : result.map(({ value }) => value);
	}
};
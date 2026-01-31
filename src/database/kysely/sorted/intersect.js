'use strict';

module.exports = function (module) {
	const { helpers } = module;

	module.sortedSetIntersectCard = async function (keys) {
		if (!keys?.length) {
			return 0;
		}

		const now = new Date().toISOString();

		// Get all values and count occurrences across sets
		const rows = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', join =>
				join.onRef('o._key', '=', 'z._key')
					.on('o.type', '=', 'zset'))
			.select(['z.value'])
			.select(eb => eb.fn.countAll().as('c'))
			.where('o._key', 'in', keys)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.groupBy('z.value')
			.execute();

		// Count values that appear in all sets
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

	async function getSortedSetIntersect({ sets, weights = [], aggregate = 'SUM', sort, withScores, start = 0, stop = -1 }) {
		if (!sets?.length) {
			return [];
		}

		const limit = stop - start + 1 > 0 ? stop - start + 1 : null;
		const weightMap = helpers.createWeightMap(sets, weights);
		const now = new Date().toISOString();

		// For MySQL 4 / SQLite compatibility, we emulate weighted intersect with application logic
		const rows = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', join =>
				join.onRef('o._key', '=', 'z._key')
					.on('o.type', '=', 'zset'))
			.select(['o._key as k', 'z.value', 'z.score'])
			.where('o._key', 'in', sets)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.execute();

		// Build array using Map, then filter/aggregate/sort/paginate
		const result = [...rows.reduce((acc, { k, value, score }) => {
			const prev = acc.get(value) || { value, scores: [], sets: new Set() };
			return acc.set(value, {
				value,
				scores: [...prev.scores, parseFloat(score) * helpers.getWeight(weightMap, k)],
				sets: new Set([...prev.sets, k]),
			});
		}, new Map()).values()]
			.filter(({ sets: s }) => s.size === sets.length)
			.map(({ value, scores }) => ({ value, score: helpers.aggregateScores(scores, aggregate) }))
			.sort((a, b) => (sort > 0 ? a.score - b.score : b.score - a.score))
			.slice(start, limit ? start + limit : undefined);

		return withScores ? result : result.map(({ value }) => value);
	}
};
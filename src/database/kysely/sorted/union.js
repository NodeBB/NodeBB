'use strict';

module.exports = function (module) {
	const helpers = require('../helpers');

	module.sortedSetUnionCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return 0;
		}

		const { dialect } = module;
		const now = helpers.getCurrentTimestamp(dialect);

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

	async function getSortedSetUnion(params) {
		const { sets } = params;
		if (!sets || !sets.length) {
			return [];
		}
		const start = Object.prototype.hasOwnProperty.call(params, 'start') ? params.start : 0;
		const stop = Object.prototype.hasOwnProperty.call(params, 'stop') ? params.stop : -1;
		const weights = params.weights || [];
		const aggregate = params.aggregate || 'SUM';

		const weightMap = helpers.createWeightMap(sets, weights);

		let limit = stop - start + 1;
		if (limit <= 0) {
			limit = null;
		}

		const { dialect } = module;
		const now = helpers.getCurrentTimestamp(dialect);

		// For MySQL 4 / SQLite compatibility, we emulate weighted union with application logic
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

		// Build a map: value -> weighted scores
		const valueScores = {};
		rows.forEach((row) => {
			const weight = helpers.getWeight(weightMap, row.k);
			const weightedScore = parseFloat(row.score) * weight;

			if (!valueScores[row.value]) {
				valueScores[row.value] = [];
			}
			valueScores[row.value].push(weightedScore);
		});

		// Aggregate scores
		const aggregatedValues = Object.entries(valueScores).map(([value, scores]) => ({
			value,
			score: helpers.aggregateScores(scores, aggregate),
		}));

		// Sort
		if (params.sort > 0) {
			aggregatedValues.sort((a, b) => a.score - b.score);
		} else {
			aggregatedValues.sort((a, b) => b.score - a.score);
		}

		// Apply offset and limit
		let result = aggregatedValues.slice(start);
		if (limit !== null) {
			result = result.slice(0, limit);
		}

		if (params.withScores) {
			return result.map(r => ({ value: r.value, score: r.score }));
		}
		return result.map(r => r.value);
	}
};
'use strict';

module.exports = function (module) {
	const helpers = require('../helpers');

	module.sortedSetIntersectCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return 0;
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);

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
		const keysCount = keys.length;
		let count = 0;
		rows.forEach((row) => {
			if (parseInt(row.c, 10) === keysCount) {
				count += 1;
			}
		});

		return count;
	};

	module.getSortedSetIntersect = async function (params) {
		params.sort = 1;
		return await getSortedSetIntersect(params);
	};

	module.getSortedSetRevIntersect = async function (params) {
		params.sort = -1;
		return await getSortedSetIntersect(params);
	};

	async function getSortedSetIntersect(params) {
		const { sets } = params;
		if (!sets || !sets.length) {
			return [];
		}
		const start = params.hasOwnProperty('start') ? params.start : 0;
		const stop = params.hasOwnProperty('stop') ? params.stop : -1;
		let weights = params.weights || [];
		const aggregate = params.aggregate || 'SUM';

		if (sets.length < weights.length) {
			weights = weights.slice(0, sets.length);
		}
		while (sets.length > weights.length) {
			weights.push(1);
		}

		let limit = stop - start + 1;
		if (limit <= 0) {
			limit = null;
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);

		// For MySQL 4 / SQLite compatibility, we emulate weighted intersect with application logic
		// Get all values with their scores from all sets
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

		// Build a map: value -> { setKey -> weightedScore }
		const weightMap = {};
		sets.forEach((set, idx) => {
			weightMap[set] = weights[idx];
		});

		const valueData = {};
		rows.forEach((row) => {
			const weight = weightMap.hasOwnProperty(row.k) ? weightMap[row.k] : 1;
			const weightedScore = parseFloat(row.score) * weight;
			
			if (!valueData[row.value]) {
				valueData[row.value] = { scores: [], sets: new Set() };
			}
			valueData[row.value].scores.push(weightedScore);
			valueData[row.value].sets.add(row.k);
		});

		// Filter to only values that appear in all sets (intersection)
		const setsCount = sets.length;
		const intersectedValues = [];
		
		Object.entries(valueData).forEach(([value, data]) => {
			if (data.sets.size === setsCount) {
				let score;
				if (aggregate === 'SUM') {
					score = data.scores.reduce((a, b) => a + b, 0);
				} else if (aggregate === 'MIN') {
					score = Math.min(...data.scores);
				} else if (aggregate === 'MAX') {
					score = Math.max(...data.scores);
				} else {
					score = data.scores.reduce((a, b) => a + b, 0);
				}
				intersectedValues.push({ value, score });
			}
		});

		// Sort
		if (params.sort > 0) {
			intersectedValues.sort((a, b) => a.score - b.score);
		} else {
			intersectedValues.sort((a, b) => b.score - a.score);
		}

		// Apply offset and limit
		let result = intersectedValues.slice(start);
		if (limit !== null) {
			result = result.slice(0, limit);
		}

		if (params.withScores) {
			return result.map(r => ({ value: r.value, score: r.score }));
		}
		return result.map(r => r.value);
	}
};
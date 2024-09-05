'use strict';

module.exports = function (module) {
	const helpers = require('../helpers');
	const _ = require('lodash');

	module.sortedSetUnionCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return 0;
		}

		const [ params, keyList ] = helpers.listParams({}, keys);
		const rows = module.db.prepare(`
		SELECT z."value" v
			FROM "legacy_object_live" o
				INNER JOIN "legacy_zset" z
								ON o."_key" = z."_key"
						   AND o."type" = z."type"
		WHERE o."_key" IN (${keyList})`).all(params);

		const byValue = _.groupBy(rows, 'v');
		return _.keys(byValue).length;
	};

	module.getSortedSetUnion = async function (options) {
		options.sort = 1;
		return await getSortedSetUnion(options);
	};

	module.getSortedSetRevUnion = async function (options) {
		options.sort = -1;
		return await getSortedSetUnion(options);
	};

	async function getSortedSetUnion(options) {
		let { 
			sets, 
			start = 0, 
			stop = -1, 
			sort = -1, 
			withScores = false,
			weights = [],
			aggregate = 'SUM'
		} = options;
		if (!sets || !sets.length) {
			return [];
		}

		if (sets.length < weights.length) {
			weights = weights.slice(0, sets.length);
		}
		while (sets.length > weights.length) {
			weights.push(1);
		}

		const [ params, keyList ] = helpers.listParams({}, sets);
		const rows = module.db.prepare(`
		SELECT z."_key" k, z."value" v, z."score" s
			FROM "legacy_object_live" o
				INNER JOIN "legacy_zset" z
								ON o."_key" = z."_key"
	 						 AND o."type" = z."type"
			WHERE o."_key" IN (${keyList})
			ORDER BY z."score" ${sort > 0 ? 'ASC' : 'DESC'}`).all(params);

		const byValue = _.groupBy(rows, 'v');
		let results = _.map(byValue, (rows, value) => {
			const scores = rows.map(r => {
				const index = sets.indexOf(r.k);
				return r.s * weights[index];
			});
			const score = helpers.aggregateScores(scores, aggregate);
			return { value, score };
		});
			
		results.sort((a, b) => (a.score - b.score) * sort);
		results = results.slice(start, stop >= 0 ? stop : undefined)

		return withScores ? results : results.map(r => r.value);
	}
};

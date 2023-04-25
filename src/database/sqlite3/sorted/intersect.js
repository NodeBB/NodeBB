'use strict';

module.exports = function (module) {
	const helpers = require('../helpers');
	const _ = require('lodash');

	module.sortedSetIntersectCard = async function (keys) {
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

		const byValue = _.pickBy(_.groupBy(rows, 'v'), a => a.length === keys.length);
		return _.keys(byValue).length;
	};

	module.getSortedSetIntersect = async function (options) {
		options.sort = 1;
		return await getSortedSetIntersect(options);
	};

	module.getSortedSetRevIntersect = async function (options) {
		options.sort = -1;
		return await getSortedSetIntersect(options);
	};

	async function getSortedSetIntersect(options) {
		let { 
			sets, 
			start = 0, 
			stop = -1, 
			sort = -1, 
			withScores = false,
			weights = [],
			aggregate = 'SUM',
		} = options;

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
			WHERE o."_key" IN (${keyList})`).all(params);

		const byValue = _.pickBy(_.groupBy(rows, 'v'), a => a.length === sets.length);
		let results = _.map(byValue, (rows, value) => {
			const scores = rows.map(r => {
				const index = sets.indexOf(r.k);
				return r.s * weights[index];
			});
			const score = helpers.aggregateScores(scores, aggregate);
			return { value, score };
		});
		
		results.sort((a, b) => (a.score - b.score) * sort);
		results = results.slice(start, stop >= 0 ? stop + 1 : undefined)

		return withScores ? results : results.map(r => r.value);
	}
};

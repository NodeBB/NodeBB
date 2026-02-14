
'use strict';

module.exports = function (module) {
	const helpers = require('../helpers');
	module.sortedSetUnionCard = async function (keys) {
		const tempSetName = `temp_${Date.now()}`;
		if (!keys.length) {
			return 0;
		}
		const multi = module.client.multi();
		multi.zunionstore([tempSetName, keys.length].concat(keys));
		multi.zcard(tempSetName);
		multi.del(tempSetName);
		const results = await helpers.execBatch(multi);
		return Array.isArray(results) && results.length ? results[1] : 0;
	};

	module.getSortedSetUnion = async function (params) {
		params.method = 'zrange';
		return await module.sortedSetUnion(params);
	};

	module.getSortedSetRevUnion = async function (params) {
		params.method = 'zrevrange';
		return await module.sortedSetUnion(params);
	};

	module.sortedSetUnion = async function (params) {
		if (!params.sets.length) {
			return [];
		}

		const tempSetName = `temp_${Date.now()}`;

		const rangeParams = [tempSetName, params.start, params.stop];
		if (params.withScores) {
			rangeParams.push('WITHSCORES');
		}

		const multi = module.client.multi();
		multi.zunionstore([tempSetName, params.sets.length].concat(params.sets));
		multi[params.method](rangeParams);
		multi.del(tempSetName);
		let results = await helpers.execBatch(multi);
		if (!params.withScores) {
			return results ? results[1] : null;
		}
		results = results[1] || [];
		return helpers.zsetToObjectArray(results);
	};
};

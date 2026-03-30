
'use strict';

module.exports = function (module) {
	const helpers = require('../helpers');
	module.sortedSetUnionCard = async function (keys) {
		if (!keys.length) {
			return 0;
		}
		const results = await module.client.zUnion(keys);
		return results ? results.length : 0;
	};

	module.getSortedSetUnion = async function (params) {
		params.reverse = false;
		return await module.sortedSetUnion(params);
	};

	module.getSortedSetRevUnion = async function (params) {
		params.reverse = true;
		return await module.sortedSetUnion(params);
	};

	module.sortedSetUnion = async function (params) {
		if (!params.sets.length) {
			return [];
		}

		const tempSetName = `temp_${Date.now()}`;
		const rangeCmd = params.withScores ? 'zRangeWithScores' : 'zRange';
		const multi = module.client.multi();
		multi.zUnionStore(tempSetName, params.sets);
		multi[rangeCmd](tempSetName, params.start, params.stop, { REV: params.reverse });
		multi.del(tempSetName);
		let results = await helpers.execBatch(multi);
		if (!params.withScores) {
			return results ? results[1] : null;
		}
		results = results[1] || [];
		return results;
	};
};

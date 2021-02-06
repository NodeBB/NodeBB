
'use strict';

module.exports = function (module) {
	const helpers = require('../helpers');
	module.sortedSetIntersectCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return 0;
		}
		const tempSetName = `temp_${Date.now()}`;

		const interParams = [tempSetName, keys.length].concat(keys);

		const multi = module.client.multi();
		multi.zinterstore(interParams);
		multi.zcard(tempSetName);
		multi.del(tempSetName);
		const results = await helpers.execBatch(multi);
		return results[1] || 0;
	};

	module.getSortedSetIntersect = async function (params) {
		params.method = 'zrange';
		return await getSortedSetRevIntersect(params);
	};

	module.getSortedSetRevIntersect = async function (params) {
		params.method = 'zrevrange';
		return await getSortedSetRevIntersect(params);
	};

	async function getSortedSetRevIntersect(params) {
		const { sets } = params;
		const start = params.hasOwnProperty('start') ? params.start : 0;
		const stop = params.hasOwnProperty('stop') ? params.stop : -1;
		const weights = params.weights || [];

		const tempSetName = `temp_${Date.now()}`;

		let interParams = [tempSetName, sets.length].concat(sets);
		if (weights.length) {
			interParams = interParams.concat(['WEIGHTS'].concat(weights));
		}

		if (params.aggregate) {
			interParams = interParams.concat(['AGGREGATE', params.aggregate]);
		}

		const rangeParams = [tempSetName, start, stop];
		if (params.withScores) {
			rangeParams.push('WITHSCORES');
		}

		const multi = module.client.multi();
		multi.zinterstore(interParams);
		multi[params.method](rangeParams);
		multi.del(tempSetName);
		let results = await helpers.execBatch(multi);

		if (!params.withScores) {
			return results ? results[1] : null;
		}
		results = results[1] || [];
		return helpers.zsetToObjectArray(results);
	}
};

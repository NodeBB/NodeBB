
'use strict';

module.exports = function (module) {
	const helpers = require('../helpers');
	module.sortedSetIntersectCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return 0;
		}
		var tempSetName = `temp_${Date.now()}`;

		var interParams = [tempSetName, keys.length].concat(keys);

		var multi = module.client.multi();
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
		var sets = params.sets;
		var start = params.hasOwnProperty('start') ? params.start : 0;
		var stop = params.hasOwnProperty('stop') ? params.stop : -1;
		var weights = params.weights || [];

		var tempSetName = `temp_${Date.now()}`;

		var interParams = [tempSetName, sets.length].concat(sets);
		if (weights.length) {
			interParams = interParams.concat(['WEIGHTS'].concat(weights));
		}

		if (params.aggregate) {
			interParams = interParams.concat(['AGGREGATE', params.aggregate]);
		}

		var rangeParams = [tempSetName, start, stop];
		if (params.withScores) {
			rangeParams.push('WITHSCORES');
		}

		var multi = module.client.multi();
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

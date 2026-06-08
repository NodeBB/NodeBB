'use strict';

module.exports = function (module) {
	const { helpers } = module;

	module.sortedSetUnionCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) return 0;
		const result = await helpers.createZsetQuery()
			.select(eb => eb.fn.count(eb.fn('distinct', ['z.value'])).as('c'))
			.where('o._key', 'in', keys)
			.executeTakeFirst();
		return parseInt(result?.c || 0, 10);
	};

	// NodeBB's callback-compat layer detects `AsyncFunction.constructor.name`
	// to inject node-style callback shims, so these must be `async function`,
	// not plain arrows that happen to return a Promise.
	module.getSortedSetUnion = async function (params) {
		return await helpers.aggregateZsets({ ...params, sort: 1 });
	};
	module.getSortedSetRevUnion = async function (params) {
		return await helpers.aggregateZsets({ ...params, sort: -1 });
	};
	module.sortedSetUnion = async function (params) {
		const sort = (params.method === 'zrevrange' || params.method === 'zrevrangebyscore') ? -1 : 1;
		return await helpers.aggregateZsets({ ...params, sort });
	};
};

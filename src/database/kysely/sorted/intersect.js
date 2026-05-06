'use strict';

module.exports = function (module) {
	const { helpers } = module;

	module.sortedSetIntersectCard = async function (keys) {
		if (!keys?.length) return 0;
		// Count values that appear in every key: COUNT(DISTINCT _key) = N.
		const rows = await helpers.createZsetQuery()
			.select(['z.value'])
			.select(eb => eb.fn.count(eb.fn('distinct', ['z._key'])).as('c'))
			.where('o._key', 'in', keys)
			.groupBy('z.value')
			.execute();
		return rows.filter(({ c }) => parseInt(c, 10) === keys.length).length;
	};

	// `async function` (not arrow) so NodeBB's callback-compat layer detects
	// AsyncFunction and injects the node-style trailing-callback shim.
	module.getSortedSetIntersect = async function (params) {
		return await helpers.aggregateZsets({ ...params, sort: 1, intersect: true });
	};
	module.getSortedSetRevIntersect = async function (params) {
		return await helpers.aggregateZsets({ ...params, sort: -1, intersect: true });
	};
};

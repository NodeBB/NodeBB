'use strict';

define('admin/dashboard/topics', ['admin/modules/dashboard-line-graph'], (graph) => {
	const ACP = {};

	ACP.init = () => {
		graph.init({
			set: 'topics',
			dataset: ajaxify.data.dataset,
		});
	};

	return ACP;
});

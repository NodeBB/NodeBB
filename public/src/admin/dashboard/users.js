'use strict';

define('admin/dashboard/users', ['admin/modules/dashboard-line-graph'], (graph) => {
	const ACP = {};

	ACP.init = () => {
		graph.init({
			set: 'registrations',
			dataset: ajaxify.data.dataset,
		});
	};

	return ACP;
});

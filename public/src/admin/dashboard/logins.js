'use strict';

define('admin/dashboard/logins', ['admin/modules/dashboard-line-graph'], (graph) => {
	const ACP = {};

	ACP.init = () => {
		graph.init({
			set: 'logins',
			dataset: ajaxify.data.dataset,
		});
	};

	return ACP;
});

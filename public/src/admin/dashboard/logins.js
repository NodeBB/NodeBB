'use strict';

define('admin/dashboard/logins', ['admin/modules/dashboard-line-graph', 'admin/modules/fullscreen'], (graph, { setupFullscreen }) => {
	const ACP = {};

	ACP.init = () => {
		graph.init({
			set: 'logins',
			dataset: ajaxify.data.dataset,
		});
		setupFullscreen($('#expand-analytics'), $('#analytics-panel'));
	};

	return ACP;
});

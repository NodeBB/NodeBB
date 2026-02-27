'use strict';

define('admin/dashboard/topics', [
	'admin/modules/dashboard-line-graph', 'hooks', 'admin/modules/fullscreen',
], (graph, hooks, { setupFullscreen }) => {
	const ACP = {};

	ACP.init = () => {
		graph.init({
			set: 'topics',
			dataset: ajaxify.data.dataset,
		}).then(() => {
			hooks.onPage('action:admin.dashboard.updateGraph', ACP.updateTable);
		});
		setupFullscreen($('#expand-analytics'), $('#analytics-panel'));
	};

	ACP.updateTable = () => {
		if (window.fetch) {
			fetch(`${config.relative_path}/api${ajaxify.data.url}${window.location.search}`, { credentials: 'include' }).then((response) => {
				if (response.ok) {
					response.json().then(function (payload) {
						app.parseAndTranslate(ajaxify.data.template.name, 'topics', payload, function (html) {
							const tbodyEl = document.querySelector('.topics-list tbody');
							tbodyEl.innerHTML = '';
							tbodyEl.append(...html.map((idx, el) => el));
						});
					});
				}
			});
		}
	};

	return ACP;
});

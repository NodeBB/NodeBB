'use strict';

define('admin/dashboard/users', ['admin/modules/dashboard-line-graph', 'hooks'], (graph, hooks) => {
	const ACP = {};

	ACP.init = () => {
		graph.init({
			set: 'registrations',
			dataset: ajaxify.data.dataset,
		}).then(() => {
			hooks.onPage('action:admin.dashboard.updateGraph', ACP.updateTable);
		});
	};

	ACP.updateTable = () => {
		if (window.fetch) {
			fetch(`${config.relative_path}/api${ajaxify.data.url}${window.location.search}`, { credentials: 'include' }).then((response) => {
				if (response.ok) {
					response.json().then(function (payload) {
						app.parseAndTranslate(ajaxify.data.template.name, 'users', payload, function (html) {
							const tbodyEl = document.querySelector('.users-list tbody');
							tbodyEl.innerHTML = '';
							tbodyEl.append(...html.map((idx, el) => el));

							html.find('.timeago').timeago();
						});
					});
				}
			});
		}
	};

	return ACP;
});

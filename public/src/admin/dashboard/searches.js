'use strict';

define('admin/dashboard/searches', ['alerts', 'bootbox'], (alerts, bootbox) => {
	const ACP = {};

	ACP.init = () => {
		$('#clear-search-history').on('click', () => {
			bootbox.confirm('[[admin/dashboard:clear-search-history-confirm]]', function (ok) {
				if (ok) {
					socket.emit('admin.clearSearchHistory', function (err) {
						if (err) {
							return alerts.error(err);
						}
						ajaxify.refresh();
					});
				}
			});
		});
	};

	return ACP;
});

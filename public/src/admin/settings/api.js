'use strict';

define('admin/settings/api', ['settings', 'alerts', 'hooks'], function (settings, alerts, hooks) {
	const ACP = {};

	ACP.init = function () {
		settings.load('core.api', $('.core-api-settings'));
		$('#save').on('click', saveSettings);

		hooks.on('action:settings.sorted-list.itemLoaded', (ev, { element }) => {
			element.addEventListener('click', (ev) => {
				if (ev.target.closest('input[readonly]')) {
					// Select entire input text
					ev.target.selectionStart = 0;
					ev.target.selectionEnd = ev.target.value.length;
				}
			});
		});
	};

	function saveSettings() {
		settings.save('core.api', $('.core-api-settings'), function () {
			alerts.alert({
				type: 'success',
				alert_id: 'core.api-saved',
				title: 'Settings Saved',
				timeout: 5000,
			});
			ajaxify.refresh();
		});
	}

	return ACP;
});

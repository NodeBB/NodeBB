'use strict';

define('admin/settings/api', ['settings', 'alerts', 'hooks'], function (settings, alerts, hooks) {
	const ACP = {};

	ACP.init = function () {
		settings.load('core.api', $('.core-api-settings'));
		$('#save').on('click', saveSettings);

		hooks.on('filter:settings.sorted-list.loadItem', ({ item }) => {
			if (!ajaxify.data.lastSeen[item.token]) {
				item.lastSeen = '[[admin/settings/api:last-seen-never]]';
				return { item };
			}

			const cutoffMs = 1000 * 60 * 60 * 24 * Math.max(0, parseInt(config.timeagoCutoff, 10));
			let translationSuffix = 'ago';
			if (cutoffMs > 0 && Date.now() - ajaxify.data.lastSeen[item.token] > cutoffMs) {
				translationSuffix = 'on';
			}
			item.lastSeen = `[[admin/settings/api:last-seen-${translationSuffix}, ${ajaxify.data.lastSeenISO[item.token]}]]`;

			return { item };
		});

		hooks.on('action:settings.sorted-list.loaded', ({ listEl }) => {
			$(listEl).find('.timeago').timeago();
		});

		hooks.on('action:settings.sorted-list.itemLoaded', ({ element }) => {
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

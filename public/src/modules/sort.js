'use strict';


define('sort', ['components', 'api'], function (components, api) {
	const module = {};

	module.handleSort = function (field, gotoOnSave) {
		const threadSort = components.get('thread/sort');
		threadSort.find('i').removeClass('fa-check');
		const currentSetting = threadSort.find('a[data-sort="' + config[field] + '"]');
		currentSetting.find('i').addClass('fa-check');

		$('body')
			.off('click', '[component="thread/sort"] a')
			.on('click', '[component="thread/sort"] a', function () {
				function refresh(newSetting, params) {
					config[field] = newSetting;
					const qs = decodeURIComponent($.param(params));
					ajaxify.go(gotoOnSave + (qs ? '?' + qs : ''));
				}
				const newSetting = $(this).attr('data-sort');
				if (app.user.uid) {
					const payload = { settings: {} };
					payload.settings[field] = newSetting;
					api.put(`/users/${app.user.uid}/settings`, payload).then(() => {
						refresh(newSetting, utils.params());
					});
				} else {
					const urlParams = utils.params();
					urlParams.sort = newSetting;
					refresh(newSetting, urlParams);
				}
			});
	};

	return module;
});

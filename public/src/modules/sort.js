'use strict';


define('sort', ['components', 'api'], function (components, api) {
	var module = {};

	module.handleSort = function (field, gotoOnSave) {
		var threadSort = components.get('thread/sort');
		threadSort.find('i').removeClass('fa-check');
		var currentSetting = threadSort.find('a[data-sort="' + config[field] + '"]');
		currentSetting.find('i').addClass('fa-check');

		$('body')
			.off('click', '[component="thread/sort"] a')
			.on('click', '[component="thread/sort"] a', function () {
				function refresh(newSetting, params) {
					config[field] = newSetting;
					var qs = decodeURIComponent($.param(params));
					ajaxify.go(gotoOnSave + (qs ? '?' + qs : ''));
				}
				var newSetting = $(this).attr('data-sort');
				if (app.user.uid) {
					const payload = { settings: {} };
					payload.settings[field] = newSetting;
					api.put(`/users/${app.user.uid}/settings`, payload).then(() => {
						refresh(newSetting, utils.params());
					});
				} else {
					var urlParams = utils.params();
					urlParams.sort = newSetting;
					refresh(newSetting, urlParams);
				}
			});
	};

	return module;
});

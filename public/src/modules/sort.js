'use strict';


define('sort', ['components'], function (components) {
	var module = {};

	module.handleSort = function (field, method, gotoOnSave) {
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
					socket.emit(method, newSetting, function (err) {
						if (err) {
							return app.alertError(err.message);
						}
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

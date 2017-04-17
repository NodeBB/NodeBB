'use strict';


define('sort', ['components'], function (components) {
	var module = {};

	module.handleSort = function (field, method, gotoOnSave) {
		var threadSort = components.get('thread/sort');
		threadSort.find('i').removeClass('fa-check');
		var currentSetting = threadSort.find('a[data-sort="' + config[field] + '"]');
		currentSetting.find('i').addClass('fa-check');

		$('.category, .topic').on('click', '[component="thread/sort"] a', function () {
			var newSetting = $(this).attr('data-sort');
			socket.emit(method, newSetting, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				config[field] = newSetting;
				ajaxify.go(gotoOnSave);
			});
		});
	};

	return module;
});

'use strict';
/* globals define, config, socket, app, ajaxify, translator, templates */

define('sort', function() {
	var module = {};

	module.handleSort = function (field, method, gotoOnSave) {
		var threadSort = $('.thread-sort');
		threadSort.find('i').removeClass('fa-check');
		var currentSetting = threadSort.find('a[data-sort="' + config[field] + '"]');
		currentSetting.find('i').addClass('fa-check');

		$('.thread-sort').on('click', 'a', function() {
			var newSetting = $(this).attr('data-sort');
			socket.emit(method, newSetting, function(err) {
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

'use strict';


define('sort', ['components'], function (components) {
	const module = {};

	module.handleSort = function (field, gotoOnSave) {
		const threadSort = components.get('thread/sort');
		threadSort.find('i').removeClass('fa-check');
		const currentSort = utils.params().sort || config[field];
		const currentSetting = threadSort.find('a[data-sort="' + currentSort + '"]');
		currentSetting.find('i').addClass('fa-check');

		$('body')
			.off('click', '[component="thread/sort"] a[data-sort]')
			.on('click', '[component="thread/sort"] a[data-sort]', function () {
				const newSetting = $(this).attr('data-sort');
				const urlParams = utils.params();
				urlParams.sort = newSetting;
				const qs = $.param(urlParams);
				ajaxify.go(gotoOnSave + (qs ? '?' + qs : ''));
			});
	};

	return module;
});

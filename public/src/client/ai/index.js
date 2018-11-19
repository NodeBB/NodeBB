'use strict';


define('ai/index', [], function () {
	var Index = {};

	Index.init = function () {
		var container = $('.composer');

		if (container.length) {
			$(window).trigger('action:composer.enhance', {
				container: 'index',
			});
		}
	};

	return Index;
});

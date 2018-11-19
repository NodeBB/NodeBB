'use strict';


define('ai/module', [], function () {
	var Module = {};

	Module.init = function () {
		var container = $('.composer');

		if (container.length) {
			$(window).trigger('action:composer.enhance', {
				container: 'Module',
			});
		}
	};

	return Module;
});

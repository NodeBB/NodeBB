'use strict';


define('forum/compose', ['hooks'], function (hooks) {
	var Compose = {};

	Compose.init = function () {
		var container = $('.composer');

		if (container.length) {
			hooks.fire('action:composer.enhance', {
				container: container,
			});
		}
	};

	return Compose;
});

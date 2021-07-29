'use strict';


define('forum/compose', [], function () {
	var Compose = {};

	Compose.init = function () {
		var container = $('.composer');

		if (container.length) {
			require(['hooks'], function (hooks) {
				hooks.fire('action:composer.enhance', {
					container: container,
				});
			});
		}
	};

	return Compose;
});

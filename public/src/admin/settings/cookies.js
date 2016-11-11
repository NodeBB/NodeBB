'use strict';

/* globals define */

define('admin/settings/cookies', [
	'admin/modules/colorpicker'
], function (colorpicker) {
	var Module = {};

	Module.init = function () {
		colorpicker.enable($('[data-colorpicker="1"]'));
	};

	return Module;
});
"use strict";
/* global define, socket */

define('admin/settings/general', ['admin/settings'], function(Settings) {
	var Module = {}

	Module.init = function() {
		$('button[data-action="removeLogo"]').on('click', function() {
			$('input[data-field="brand:logo"]').val('');
		});
	};

	return Module;
});

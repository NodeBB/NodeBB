"use strict";
/* global define, socket */

define('admin/settings/general', ['admin/settings'], function(Settings) {
	var Module = {}

	Module.init = function() {
		$('button[data-action="removeLogo"]').on('click', function() {
			$('input[data-field="brand:logo"]').val('');
		});
		$('button[data-action="removeFavicon"]').on('click', function() {
			$('input[data-field="brand:favicon"]').val('');
		});
		$('button[data-action="removeTouchIcon"]').on('click', function() {
			$('input[data-field="brand:touchIcon"]').val('');
		});
	};

	return Module;
});

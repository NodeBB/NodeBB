"use strict";
/*global define*/

define('admin/general/languages', ['admin/settings'], function(Settings) {
	var Languages = {}

	Languages.init = function() {
		Settings.prepare();
	};

	return Languages;
});

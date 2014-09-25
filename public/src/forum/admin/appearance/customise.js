"use strict";
/* global define, app, socket */

define('forum/admin/appearance/customise', ['forum/admin/settings'], function(Settings) {
	var Customise = {};
	
	Customise.init = function() {		
		var	customCSSEl = $('textarea[data-field]')[0];
		tabIndent.config.tab = '    ';
		tabIndent.render(customCSSEl);

		Settings.prepare();
	};

	return Customise;
});

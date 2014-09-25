"use strict";
/* global define, app, socket */

define('forum/admin/appearance/customise', ['forum/admin/settings'], function(Settings) {
	var Customise = {};
	
	Customise.init = function() {		
		Settings.prepare(function() {
			$('#customCSS').text($('#customCSS-holder').val());
			$('#customHTML').text($('#customHTML-holder').val());
			
			var customCSS = ace.edit("customCSS"),
				customHTML = ace.edit("customHTML");

			customCSS.setTheme("ace/theme/twilight");
			customCSS.getSession().setMode("ace/mode/css");	

			customCSS.on('change', function(e) {
			    $('#customCSS-holder').val(customCSS.getValue());
			}); 

			customHTML.setTheme("ace/theme/twilight");
			customHTML.getSession().setMode("ace/mode/html");

			customHTML.on('change', function(e) {
			    $('#customHTML-holder').val(customHTML.getValue());
			}); 
		});
	};

	return Customise;
});
	
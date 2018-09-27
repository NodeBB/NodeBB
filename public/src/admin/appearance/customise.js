'use strict';

define('admin/appearance/customise', ['admin/settings', 'ace/ace'], function (Settings, ace) {
	var Customise = {};

	Customise.init = function () {
		Settings.prepare(function () {
			$('#customCSS').text($('#customCSS-holder').val());
			$('#customJS').text($('#customJS-holder').val());
			$('#customHTML').text($('#customHTML-holder').val());

			var customCSS = ace.edit('customCSS');
			var customJS = ace.edit('customJS');
			var customHTML = ace.edit('customHTML');

			customCSS.setTheme('ace/theme/twilight');
			customCSS.getSession().setMode('ace/mode/less');

			customCSS.on('change', function () {
				app.flags = app.flags || {};
				app.flags._unsaved = true;
				$('#customCSS-holder').val(customCSS.getValue());
			});

			customJS.setTheme('ace/theme/twilight');
			customJS.getSession().setMode('ace/mode/javascript');

			customJS.on('change', function () {
				app.flags = app.flags || {};
				app.flags._unsaved = true;
				$('#customJS-holder').val(customJS.getValue());
			});

			customHTML.setTheme('ace/theme/twilight');
			customHTML.getSession().setMode('ace/mode/html');

			customHTML.on('change', function () {
				app.flags = app.flags || {};
				app.flags._unsaved = true;
				$('#customHTML-holder').val(customHTML.getValue());
			});

			$('#save').on('click', function () {
				if ($('#enableLiveReload').is(':checked')) {
					socket.emit('admin.reloadAllSessions');
				}
			});
		});
	};

	return Customise;
});

'use strict';

define('admin/appearance/customise', ['admin/settings', 'ace/ace'], function (Settings, ace) {
	var Customise = {};

	ace.config.set('packaged', true);
	ace.config.set('basePath', require.toUrl('ace').replace(/\?v=[a-z1-9]{11}/, ''));

	Customise.init = function () {
		Settings.prepare(function () {
			$('#customCSS').text($('#customCSS-holder').val());
			$('#customHTML').text($('#customHTML-holder').val());

			var customCSS = ace.edit('customCSS');
			var customHTML = ace.edit('customHTML');

			customCSS.setTheme('ace/theme/twilight');
			customCSS.getSession().setMode('ace/mode/css');

			customCSS.on('change', function () {
				app.flags = app.flags || {};
				app.flags._unsaved = true;
				$('#customCSS-holder').val(customCSS.getValue());
			});

			customHTML.setTheme('ace/theme/twilight');
			customHTML.getSession().setMode('ace/mode/html');

			customHTML.on('change', function () {
				app.flags = app.flags || {};
				app.flags._unsaved = true;
				$('#customHTML-holder').val(customHTML.getValue());
			});
		});
	};

	return Customise;
});

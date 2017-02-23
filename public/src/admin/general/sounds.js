"use strict";
/* global app, define, socket */

define('admin/general/sounds', ['sounds', 'settings', 'admin/settings'], function (Sounds, Settings, AdminSettings) {
	var	SoundsAdmin = {};

	SoundsAdmin.init = function () {
		// Sounds tab
		$('.sounds').find('button[data-action="play"]').on('click', function (e) {
			e.preventDefault();

			var	soundName = $(this).parent().parent().find('select').val();
			Sounds.playSound(soundName);
		});

		// Load Form Values
		Settings.load('sounds', $('.sounds form'));

		// Saving of Form Values
		var	saveEl = $('#save');
		saveEl.on('click', function () {
			Settings.save('sounds', $('.sounds form'), function () {
				socket.emit('admin.fireEvent', {
					name: 'event:sounds.reloadMapping'
				});
				app.alertSuccess('[[admin/general/sounds:saved]]');
			});
		});

		AdminSettings.prepare();
	};

	return SoundsAdmin;
});

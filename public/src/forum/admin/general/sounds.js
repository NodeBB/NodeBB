"use strict";
/* global define, socket */

define('forum/admin/general/sounds', ['sounds', 'settings'], function(Sounds, Settings) {
	var	SoundsAdmin = {};

	SoundsAdmin.init = function() {
		// Sounds tab
		$('.sounds').find('button[data-action="play"]').on('click', function(e) {
			e.preventDefault();

			var	fileName = $(this).parent().parent().find('select').val();
			Sounds.playFile(fileName);
		});

		// Load Form Values
		Settings.load('sounds', $('.sounds form'));

		// Saving of Form Values
		var	saveEl = $('#save');
		saveEl.on('click', function() {
			Settings.save('sounds', $('.sounds form'), function() {
				socket.emit('admin.fireEvent', {
					name: 'event:sounds.reloadMapping'
				});
				app.alertSuccess('Settings Saved');
			});
		});
	};

	return SoundsAdmin;
});

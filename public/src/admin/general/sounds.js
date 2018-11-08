'use strict';


define('admin/general/sounds', ['sounds', 'settings', 'admin/settings'], function (Sounds, Settings, AdminSettings) {
	var	SoundsAdmin = {};

	SoundsAdmin.init = function () {
		// Sounds tab
		$('.sounds').find('button[data-action="play"]').on('click', function (e) {
			e.preventDefault();

			var	soundName = $(this).parent().parent().find('select')
				.val();
			Sounds.playSound(soundName);
		});

		AdminSettings.prepare();
	};

	return SoundsAdmin;
});

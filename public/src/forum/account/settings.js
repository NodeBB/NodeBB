define('forum/account/settings', ['forum/account/header'], function(header) {
	var	AccountSettings = {};

	AccountSettings.init = function() {
		header.init();

		$('#submitBtn').on('click', function() {
			var settings = {};

			$('.account').find('input, textarea, select').each(function(id, input) {
				input = $(input);
				var setting = input.attr('data-property');
				if (input.is('select')) {
					settings[setting] = input.val();
					return;
				}

				switch (input.attr('type')) {
					case 'text':
					case 'textarea':
						settings[setting] = input.val();
						break;
					case 'checkbox':
						settings[setting] = input.is(':checked') ? 1 : 0;
						break;
				}
			});

			socket.emit('user.saveSettings', {uid: ajaxify.variables.get('theirid'), settings: settings}, function(err) {
				if (err) {
					return app.alertError(err.message);
				}

				app.alertSuccess('[[success:settings-saved]]');
				app.loadConfig();
				if (parseInt(app.uid, 10) === parseInt(ajaxify.variables.get('theirid'), 10)) {
					ajaxify.refresh();
				}
			});

			return false;
		});

		socket.emit('user.getSettings', {uid: ajaxify.variables.get('theirid')}, function(err, settings) {
			var inputs = $('.account').find('input, textarea, select');

			inputs.each(function(index, input) {
				input = $(input);
				var setting = input.attr('data-property');
				if (setting) {
					if (input.is('select')) {
						input.val(settings[setting]);
						return;
					}

					switch (input.attr('type')) {
						case 'text' :
						case 'textarea' :
							input.val(settings[setting]);
							break;
						case 'checkbox' :
							input.prop('checked', !!settings[setting]);
							break;
					}
				}
			});
		});
	};

	return AccountSettings;
});

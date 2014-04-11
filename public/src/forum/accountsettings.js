define(['forum/accountheader'], function(header) {
	var	AccountSettings = {};

	AccountSettings.init = function() {
		header.init();

		$('#submitBtn').on('click', function() {
			var settings = {};

			$('.account input, .account textarea').each(function(id, input) {
				input = $(input);

				switch (input.attr('type')) {
					case 'text' :
					case 'textarea' :
						settings[input.attr('data-property')] = input.val();
						break;
					case 'checkbox' :
						settings[input.attr('data-property')] = input.is(':checked') ? 1 : 0;
						break;
				}
			});

			socket.emit('user.saveSettings', settings, function(err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('[[success:settings-saved]]');
			});

			return false;
		});

		socket.emit('user.getSettings', function(err, settings) {
			for (var setting in settings) {
				if (settings.hasOwnProperty(setting)) {
					var input = $('.account input[data-property="' + setting + '"]');

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
			}
		});
	};

	return AccountSettings;
});

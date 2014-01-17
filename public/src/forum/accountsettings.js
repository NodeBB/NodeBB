define(['forum/accountheader'], function(header) {
	var	AccountSettings = {};

	AccountSettings.init = function() {
		header.init();

		$('#submitBtn').on('click', function() {

			var settings = {
				showemail: $('#showemailCheckBox').is(':checked') ? 1 : 0
			};

			socket.emit('user.saveSettings', settings, function(err) {
				if (err) {
					return app.alertError('There was an error saving settings!');
				}
				app.alertSuccess('Settings saved!');
			});
			return false;
		});
	};

	return AccountSettings;
});

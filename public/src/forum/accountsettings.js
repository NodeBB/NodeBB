define(['forum/accountheader'], function(header) {
	var	AccountSettings = {};

	AccountSettings.init = function() {
		header.init();

		$('#submitBtn').on('click', function() {

			var settings = {
				showemail: $('#showemailCheckBox').is(':checked') ? 1 : 0
			};

			socket.emit('user.saveSettings', settings, function(err) {
				if (!err) {
					app.alertSuccess('Settings saved!');
				} else {
					app.alertError('There was an error saving settings!');
				}
			});
			return false;
		});
	};

	return AccountSettings;
});

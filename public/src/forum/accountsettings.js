$(document).ready(function() {

	$('#submitBtn').on('click', function() {

		var settings = {
			showemail: $('#showemailCheckBox').is(':checked') ? 1 : 0
		};

		socket.emit('api:user.saveSettings', settings, function(success) {
			if (success) {
				app.alertSuccess('Settings saved!');
			} else {
				app.alertError('There was an error saving settings!');
			}
		});
		return false;
	});

});
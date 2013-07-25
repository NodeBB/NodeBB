


$(document).ready(function() {

	$('#submitBtn').on('click', function() {

		var settings = {
			showemail: $('#showemailCheckBox').is(':checked')?1:0
		};

		socket.emit('api:user.saveSettings', settings);
		return false;
	});

});
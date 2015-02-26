"use strict";
/*globals define, app, ajaxify, socket, RELATIVE_PATH*/

define('forum/reset_code', function() {
	var	ResetCode = {};

	ResetCode.init = function() {
		var reset_code = ajaxify.variables.get('reset_code');

		var resetEl = $('#reset'),
			password = $('#password'),
			repeat = $('#repeat'),
			noticeEl = $('#notice');

		resetEl.on('click', function() {
			if (password.val().length < 6) {
				app.alertError('[[reset_password:password_too_short]]');
			} else if (password.val() !== repeat.val()) {
				app.alertError('[[reset_password:passwords_do_not_match]]');
			} else {
				resetEl.prop('disabled', true).html('<i class="fa fa-spin fa-refresh"></i> Changing Password');
				socket.emit('user.reset.commit', {
					code: reset_code,
					password: password.val()
				}, function(err) {
					if (err) {
						ajaxify.refresh();
						return app.alertError(err.message);
					}

					window.location.href = RELATIVE_PATH + '/login';
				});
			}
		});

		// socket.emit('user.reset.valid', reset_code, function(err, valid) {
		// 	if(err) {
		// 		return app.alertError(err.message);
		// 	}

		// 	if (valid) {
		// 		resetEl.prop('disabled', false);
		// 	} else {
		// 		var formEl = $('#reset-form');
		// 		// Show error message
		// 		$('#error').show();
		// 		formEl.remove();
		// 	}
		// });
	};

	return ResetCode;
});

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
				$('#error').addClass('hide').hide();
				noticeEl.find('strong').html('Invalid Password');
				noticeEl.find('p').html('The password entered is too short, please pick a different password.');
				noticeEl.removeClass('hide').css({display: 'block'});
			} else if (password.value !== repeat.value) {
				$('#error').hide();
				noticeEl.find('strong').html('Invalid Password');
				noticeEl.find('p').html('The two passwords you\'ve entered do not match.');
				noticeEl.removeClass('hide').css({display: 'block'});
			} else {
				socket.emit('user.reset.commit', {
					code: reset_code,
					password: password.val()
				}, function(err) {
					if(err) {
						return app.alertError(err.message);
					}
					$('#error').addClass('hide').hide();
					$('#notice').addClass('hide').hide();
					$('#success').removeClass('hide').addClass('show').show();
				});
			}
		});

		socket.emit('user.reset.valid', reset_code, function(err, valid) {
			if(err) {
				return app.alertError(err.message);
			}

			if (valid) {
				resetEl.prop('disabled', false);
			} else {
				var formEl = $('#reset-form');
				// Show error message
				$('#error').show();
				formEl.remove();
			}
		});
	};

	return ResetCode;
});

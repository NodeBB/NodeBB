'use strict';


define('forum/reset_code', ['zxcvbn'], function (zxcvbn) {
	const ResetCode = {};

	ResetCode.init = function () {
		const reset_code = ajaxify.data.code;

		const resetEl = $('#reset');
		const password = $('#password');
		const repeat = $('#repeat');

		resetEl.on('click', function () {
			const strength = zxcvbn(password.val());
			if (password.val().length < ajaxify.data.minimumPasswordLength) {
				$('#notice').removeClass('hidden');
				$('#notice strong').translateText('[[reset_password:password_too_short]]');
			} else if (password.val().length > 512) {
				$('#notice').removeClass('hidden');
				$('#notice strong').translateText('[[error:password-too-long]]');
			} else if (password.val() !== repeat.val()) {
				$('#notice').removeClass('hidden');
				$('#notice strong').translateText('[[reset_password:passwords_do_not_match]]');
			} else if (strength.score < ajaxify.data.minimumPasswordStrength) {
				$('#notice').removeClass('hidden');
				$('#notice strong').translateText('[[user:weak_password]]');
			} else {
				resetEl.prop('disabled', true).translateHtml('<i class="fa fa-spin fa-refresh"></i> [[reset_password:changing_password]]');
				socket.emit('user.reset.commit', {
					code: reset_code,
					password: password.val(),
				}, function (err) {
					if (err) {
						ajaxify.refresh();
						return app.alertError(err.message);
					}

					window.location.href = config.relative_path + '/login';
				});
			}
			return false;
		});
	};

	return ResetCode;
});

'use strict';


define('forum/reset_code', ['alerts'], function (alerts) {
	const ResetCode = {};

	ResetCode.init = function () {
		const reset_code = ajaxify.data.code;

		const resetEl = $('#reset');
		const password = $('#password');
		const repeat = $('#repeat');

		resetEl.on('click', function () {
			try {
				utils.assertPasswordValidity(password.val());

				if (password.val() !== repeat.val()) {
					throw new Error('[[reset_password:passwords_do_not_match]]');
				}

				resetEl.prop('disabled', true).translateHtml('<i class="fa fa-spin fa-refresh"></i> [[reset_password:changing_password]]');
				socket.emit('user.reset.commit', {
					code: reset_code,
					password: password.val(),
				}, function (err) {
					if (err) {
						ajaxify.refresh();
						return alerts.error(err);
					}

					window.location.href = config.relative_path + '/login';
				});
			} catch (err) {
				$('#notice').removeClass('hidden');
				$('#notice strong').translateText(err.message);
			}

			return false;
		});
	};

	return ResetCode;
});

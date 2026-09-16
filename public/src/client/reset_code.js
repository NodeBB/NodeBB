'use strict';


define('forum/reset_code', ['alerts'], function (alerts) {
	const ResetCode = {};
	let zxcvbn = null;

	ResetCode.init = function () {
		const reset_code = ajaxify.data.code;
		import('zxcvbn').then((module) => {
			zxcvbn = module.default || module;
		}).catch(() => {});

		const resetEl = $('#reset');
		const password = $('#password');
		const repeat = $('#repeat');

		resetEl.on('click', function () {
			try {
				utils.assertPasswordValidity(password.val(), zxcvbn);

				if (password.val() !== repeat.val()) {
					throw new Error('[[reset_password:passwords-do-not-match]]');
				}

				resetEl.prop('disabled', true).translateHtml('<i class="fa fa-spin fa-refresh"></i> [[reset_password:changing-password]]');
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

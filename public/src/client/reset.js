'use strict';


define('forum/reset', ['alerts'], function (alerts) {
	const ResetPassword = {};

	ResetPassword.init = function () {
		const inputEl = $('#email');
		const errorEl = $('#error');
		const successEl = $('#success');

		$('#reset').on('click', function () {
			if (inputEl.val() && inputEl.val().indexOf('@') !== -1) {
				socket.emit('user.reset.send', inputEl.val(), function (err) {
					if (err) {
						return alerts.error(err);
					}

					errorEl.addClass('hide');
					successEl.removeClass('hide');
					inputEl.val('');
				});
			} else {
				successEl.addClass('hide');
				errorEl.removeClass('hide');
			}
			return false;
		});
	};

	return ResetPassword;
});

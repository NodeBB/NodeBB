"use strict";
/*globals define, app, socket*/

define('forum/reset', function() {
	var	ResetPassword = {};

	ResetPassword.init = function() {
		var inputEl = $('#email'),
			errorEl = $('#error'),
			successEl = $('#success');

		$('#reset').on('click', function() {
			if (inputEl.val() && inputEl.val().indexOf('@') !== -1) {
				socket.emit('user.reset.send', inputEl.val(), function(err) {
					if(err) {
						return app.alertError(err.message);
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

"use strict";
/* global define, app, RELATIVE_PATH */

define('forum/login', function() {
	var	Login = {};

	Login.init = function() {
		var errorEl = $('#login-error-notify'),
			submitEl = $('#login'),
			formEl = $('#login-form');

		submitEl.on('click', function(e) {
			e.preventDefault();

			if (!$('#username').val() || !$('#password').val()) {
				translator.translate('[[error:invalid-username-or-password]]', function(translated) {
					errorEl.find('p').text(translated)
					errorEl.show();
				});
			} else {
				errorEl.hide();

				if (!submitEl.hasClass('disabled')) {
					submitEl.addClass('disabled');
					formEl.submit();
				}
			}
		});

		$('#login-error-notify button').on('click', function(e) {
			e.preventDefault();
			errorEl.hide();
		});

		$('#content #username').focus();
	};

	return Login;
});

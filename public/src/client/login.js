"use strict";
/* global define, app, config, RELATIVE_PATH */

define('forum/login', ['csrf', 'translator'], function(csrf, translator) {
	var	Login = {};

	Login.init = function() {
		var errorEl = $('#login-error-notify'),
			submitEl = $('#login'),
			formEl = $('#login-form');

		submitEl.on('click', function(e) {
			e.preventDefault();

			if (!$('#username').val() || !$('#password').val()) {
				errorEl.find('p').translateText('[[error:invalid-username-or-password]]');
				errorEl.show();
			} else {
				errorEl.hide();

				if (submitEl.hasClass('disabled')) {
					return;
				}

				submitEl.addClass('disabled');
				formEl.ajaxSubmit({
					headers: {
						'x-csrf-token': csrf.get()
					},
					success: function(data, status) {
						window.location.href = data + '?loggedin';
					},
					error: function(data, status) {
						errorEl.find('p').translateText(data.responseText);
						errorEl.show();
						submitEl.removeClass('disabled');
					}
				});
			}
		});

		$('#login-error-notify button').on('click', function(e) {
			e.preventDefault();
			errorEl.hide();
			return false;
		});

		$('#content #username').focus();

		// Add "returnTo" data if present
		if (app.previousUrl) {
			var returnToEl = document.createElement('input');
			returnToEl.type = 'hidden';
			returnToEl.name = 'returnTo';
			returnToEl.value = app.previousUrl;
			$(returnToEl).appendTo(formEl);
		}
	};

	return Login;
});

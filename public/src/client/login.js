'use strict';


define('forum/login', ['jquery-form'], function () {
	var	Login = {};

	Login.init = function () {
		var errorEl = $('#login-error-notify');
		var submitEl = $('#login');
		var formEl = $('#login-form');

		submitEl.on('click', function (e) {
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
						'x-csrf-token': config.csrf_token,
					},
					success: function (data) {
						var pathname = utils.urlToLocation(data.next).pathname;
						var params = utils.params({ url: data.next });
						params.loggedin = true;
						var qs = decodeURIComponent($.param(params));

						window.location.href = pathname + '?' + qs;
					},
					error: function (data) {
						if (data.status === 403 && data.responseText === 'Forbidden') {
							window.location.href = config.relative_path + '/login?error=csrf-invalid';
						} else {
							errorEl.find('p').translateText(data.responseText);
							errorEl.show();
							submitEl.removeClass('disabled');

							// Select the entire password if that field has focus
							if ($('#password:focus').length) {
								$('#password').select();
							}
						}
					},
				});
			}
		});

		$('#login-error-notify button').on('click', function (e) {
			e.preventDefault();
			errorEl.hide();
			return false;
		});

		if ($('#content #username').val()) {
			$('#content #password').val('').focus();
		} else {
			$('#content #username').focus();
		}
		$('#content #noscript').val('false');
	};

	return Login;
});

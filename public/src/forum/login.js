"use strict";
/* global define, app, RELATIVE_PATH */

define('forum/login', function() {
	var	Login = {};

	Login.init = function() {
		$('#login').on('click', function(e) {
			e.preventDefault();

			var loginData = {
					'username': $('#username').val(),
					'password': $('#password').val(),
					'remember': $('#remember').prop('checked'),
					'_csrf': $('#csrf-token').val()
				},
				previousUrl = $('input[name="previousUrl"]').val();

			$('#login').attr('disabled', 'disabled').html('Logging in...');
			$('#login-error-notify').hide();

			$.ajax({
				type: "POST",
				url: RELATIVE_PATH + '/login',
				data: loginData,
				success: function(data, textStatus, jqXHR) {
					$('#login').html('Redirecting...');
					if (previousUrl) {
						app.previousUrl = previousUrl;
					} else if (!app.previousUrl) {
						app.previousUrl = RELATIVE_PATH || '/';
					}

					if(app.previousUrl.indexOf('/reset/') !== -1) {
						window.location.replace(RELATIVE_PATH + "/?loggedin");
					} else {
						var index = app.previousUrl.indexOf('#');
						if(index !== -1) {
							window.location.replace(app.previousUrl.slice(0, index) + '?loggedin' + app.previousUrl.slice(index));
						} else {
							window.location.replace(app.previousUrl + "?loggedin");
						}
					}

					app.loadConfig();
				},
				error: function(data, textStatus, jqXHR) {
					var message = data.responseJSON;
					if (typeof data.responseJSON !== 'string') {
 						message = data.responseJSON.message || '';
					}
					translator.translate(message, function(errorText) {
						$('#login-error-notify').show().html(errorText);
					});

					$('#login').removeAttr('disabled').html('Login');
				},
				dataType: 'json',
				async: true
			});
		});

		$('#login-error-notify button').on('click', function(e) {
			e.preventDefault();
			$('#login-error-notify').hide();
		});

		$('#content #username').focus();
	};

	return Login;
});

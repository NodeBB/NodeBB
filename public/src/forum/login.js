define(function() {
	var	Login = {};

	Login.init = function() {
		$('#login').on('click', function(e) {
			e.preventDefault();

			var loginData = {
				'username': $('#username').val(),
				'password': $('#password').val(),
				'remember': $('#remember').prop('checked'),
				'_csrf': $('#csrf-token').val()
			};

			$('#login').attr('disabled', 'disabled').html('Logging in...');
			$('#login-error-notify').hide();

			$.ajax({
				type: "POST",
				url: RELATIVE_PATH + '/login',
				data: loginData,
				success: function(data, textStatus, jqXHR) {
					$('#login').html('Redirecting...');
					if(!app.previousUrl) {
						app.previousUrl = '/';
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
					$('#login-error-notify').show();
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

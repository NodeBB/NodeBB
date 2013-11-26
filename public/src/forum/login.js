define(function() {
	var	Login = {};

	Login.init = function() {
		// Alternate Logins
		var altLoginEl = document.querySelector('.alt-logins');
		altLoginEl.addEventListener('click', function(e) {
			var target;
			switch (e.target.nodeName) {
				case 'LI':
					target = e.target;
					break;
				case 'I':
					target = e.target.parentNode;
					break;
			}
			if (target) {
				document.location.href = target.getAttribute('data-url');
			}
		});

		$('#login').on('click', function() {
			var loginData = {
				'username': $('#username').val(),
				'password': $('#password').val(),
				'_csrf': $('#csrf-token').val()
			};

			$('#login').attr('disabled', 'disabled').html('Logging in...');
			$('#login-error-notify').hide();

			$.ajax({
				type: "POST",
				url: RELATIVE_PATH + '/login',
				data: loginData,
				success: function(data, textStatus, jqXHR) {

					if (!data.success) {
						$('#login-error-notify').show();
						$('#login').removeAttr('disabled').html('Login');
					} else {
						$('#login').html('Redirecting...');
						if(!app.previousUrl) {
							app.previousUrl = '/';
						}

						if(app.previousUrl.indexOf('/reset/') != -1)
							window.location.replace(RELATIVE_PATH + "/?loggedin");
						else
							window.location.replace(app.previousUrl + "?loggedin");

						app.loadConfig();
					}
				},
				error: function(data, textStatus, jqXHR) {
					$('#login-error-notify').show();
					$('#login').removeAttr('disabled').html('Login');
				},
				dataType: 'json',
				async: true,
				timeout: 2000
			});

			return false;
		});

		$('#login-error-notify button').on('click', function() {
			$('#login-error-notify').hide();
			return false;
		});

		document.querySelector('#content input').focus();

		if(!config.emailSetup)
			$('#reset-link').addClass('hide');
		else
			$('#reset-link').removeClass('hide');

	};

	return Login;
});

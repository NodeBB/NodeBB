(function() {
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

		$.ajax({
			type: "POST",
			url: RELATIVE_PATH + '/login',
			data: loginData,
			success: function(data, textStatus, jqXHR) {
				if (!data.success) {
					$('#login-error-notify').show();
				} else {
					$('#login-error-notify').hide();
					window.location.replace(RELATIVE_PATH + "/?loggedin");
				}
			},
			error: function(data, textStatus, jqXHR) {
				$('#login-error-notify').show();
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
}());
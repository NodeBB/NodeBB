define(function() {
	var	ResetPassword = {};

	ResetPassword.init = function() {
		var inputEl = document.getElementById('email'),
			errorEl = document.getElementById('error'),
			errorTextEl = errorEl.querySelector('p');

		document.getElementById('reset').onclick = function() {
			if (inputEl.value.length > 0 && inputEl.value.indexOf('@') !== -1) {
				socket.emit('user.reset.send', {
					email: inputEl.value
				}, function(err, data) {
					if(err) {
						return app.alertError(err.message);
					}

					var submitEl = document.getElementById('reset');

					jQuery('#error').hide();
					jQuery('#success').show();
					jQuery('#success p').html('An email has been dispatched to "' + data.email + '" with instructions on setting a new password.');
					inputEl.value = '';
				});
			} else {
				jQuery('#success').hide();
				jQuery(errorEl).show();
				errorTextEl.innerHTML = 'Please enter a valid email';
			}
		};
	};

	return ResetPassword;
});
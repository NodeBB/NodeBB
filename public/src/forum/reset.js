define('forum/reset', function() {
	var	ResetPassword = {};

	ResetPassword.init = function() {
		var inputEl = $('#email'),
			errorEl = $('#error'),
			successEl = $('#success'),
			errorTextEl = errorEl.find('p');

		$('#reset').on('click', function() {
			if (inputEl.val() && inputEl.val().indexOf('@') !== -1) {
				socket.emit('user.reset.send', inputEl.val(), function(err, data) {
					if(err) {
						return app.alertError(err.message);
					}

					errorEl.addClass('hide').hide();
					successEl.removeClass('hide').show();
					successEl.find('p').html('An email has been dispatched to "' + inputEl.val() + '" with instructions on setting a new password.');
					inputEl.val('');
				});
			} else {
				successEl.addClass('hide').hide();
				errorEl.removeClass('hide').show();
				errorTextEl.html('Please enter a valid email');
			}
		});
	};

	return ResetPassword;
});

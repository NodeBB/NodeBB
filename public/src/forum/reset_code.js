(function() {
	var reset_code = templates.get('reset_code');

	var resetEl = document.getElementById('reset'),
		password = document.getElementById('password'),
		repeat = document.getElementById('repeat'),
		noticeEl = document.getElementById('notice');

	resetEl.addEventListener('click', function() {
		if (password.value.length < 6) {
			$('#error').hide();
			noticeEl.querySelector('strong').innerHTML = 'Invalid Password';
			noticeEl.querySelector('p').innerHTML = 'The password entered is too short, please pick a different password.';
			noticeEl.style.display = 'block';
		} else if (password.value !== repeat.value) {
			$('#error').hide();
			noticeEl.querySelector('strong').innerHTML = 'Invalid Password';
			noticeEl.querySelector('p').innerHTML = 'The two passwords you\'ve entered do not match.';
			noticeEl.style.display = 'block';
		} else {
			socket.emit('user:reset.commit', {
				code: reset_code,
				password: password.value
			});
		}
	}, false);

	// Enable the form if the code is valid
	socket.emit('user:reset.valid', {
		code: reset_code
	});


	ajaxify.register_events(['user:reset.valid', 'user:reset.commit']);
	socket.on('user:reset.valid', function(data) {
		if ( !! data.valid) resetEl.disabled = false;
		else {
			var formEl = document.getElementById('reset-form');
			// Show error message
			$('#error').show();
			formEl.parentNode.removeChild(formEl);
		}
	})

	socket.on('user:reset.commit', function(data) {
		if (data.status === 'ok') {
			$('#error').hide();
			$('#notice').hide();
			$('#success').show();
		}
	});
}());
(function() {
	var username = document.getElementById('username'),
		password = document.getElementById('password'),
		register = document.getElementById('register'),
		emailEl = document.getElementById('email'),
		username_notify = document.getElementById('username-notify'),
		email_notify = document.getElementById('email-notify'),
		password_notify = document.getElementById('password-notify');

	username.onkeyup = function() {
		if (username.value.length > 2) socket.emit('user.exists', {username: username.value});
		else {
			username_notify.innerHTML = 'Username too short';
			username_notify.className = 'label label-important';
		}
	}
	emailEl.addEventListener('change', function() {
		socket.emit('user.email.exists', { email: emailEl.value });
	}, false);
	password.addEventListener('keyup', function() {
		if (password.value.length < 5) {
			password_notify.innerHTML = 'Password too short';
		} else {
			password_notify.innerHTML = '';
		}
	}, false);

	ajaxify.register_events(['user.exists', 'user.email.exists']);

	socket.on('user.exists', function(data) {
		if (data.exists == true) {
			username_notify.innerHTML = 'Username exists';
			username_notify.className = 'label label-important';
		} else {
			username_notify.innerHTML = 'Not taken';
			username_notify.className = 'label label-success';
		}
	});
	socket.on('user.email.exists', function(data) {
		if (data.exists === true) {
			email_notify.innerHTML = 'Email Address exists';
		} else {
			email_notify.innerHTML = '';
		}
	});

	// Alternate Logins
	var altLoginEl = document.querySelector('.alt-logins');
	altLoginEl.addEventListener('click', function(e) {
		var target;
		switch(e.target.nodeName) {
			case 'LI': target = e.target; break;
			case 'I': target = e.target.parentNode; break;
		}
		if (target) {
			document.location.href = target.getAttribute('data-url');
		}
	});

	// Form Validation
	function validateForm() {
		var validated = true;
		if (username.value.length < 2) {
			username_notify.innerHTML = 'Invalid username';
			username_notify.className = 'label label-important';
			validated = false;
		}

		if (password.value.length < 5) {
			password_notify.innerHTML = 'Password too short';
			validated = false;
		} else {
			password_notify.innerHTML = '';
		}

		if (email.value.indexOf('@') === -1) {
			email_notify.innerHTML = 'Invalid email address';
			validated = false;
		} else {
			email_notify.innerHTML = '';
		}

		return validated;
	}
	register.addEventListener('click', function(e) {
		if (!validateForm()) e.preventDefault();
	}, false);
}());
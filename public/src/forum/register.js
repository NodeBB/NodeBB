(function() {
	var username = document.getElementById('username'),
		password = document.getElementById('password'),
		password_confirm = document.getElementById('password-confirm'),
		register = document.getElementById('register'),
		emailEl = document.getElementById('email'),
		username_notify = document.getElementById('username-notify'),
		email_notify = document.getElementById('email-notify'),
		password_notify = document.getElementById('password-notify'),
		password_confirm_notify = document.getElementById('password-confirm-notify'),		
		usernamevalid = false;
		emailexists = false,
		emailvalid = false,
		userexists = false,
		passwordsmatch = false,
		passwordvalid = false;

	$(username).on('keyup change', function() {
		usernamevalid = utils.isUserNameValid(username.value);

		
		if(username.value.length < 3) {
			username_notify.innerHTML = 'Username too short';
			username_notify.className = 'label label-important';
		} else if(username.value.length > 13) {
			username_notify.innerHTML = 'Username too long';
			username_notify.className = 'label label-important';
		} else if(!usernamevalid) {
			username_notify.innerHTML = 'Invalid username';
			username_notify.className = 'label label-important';
		} else {
			socket.emit('user.exists', {username: username.value});
		}
	});

	$(emailEl).on('keyup change', function() {
		emailvalid = utils.isEmailValid(email.value);

		if(!emailvalid) {
			email_notify.innerHTML = 'Invalid email address';
			email_notify.className = 'label label-important';
		}
		else
			socket.emit('user.email.exists', { email: emailEl.value });
	});
	
	$(password).on('keyup', function() {
		passwordvalid = utils.isPasswordValid(password.value);
		if (password.value.length < 6) {
			password_notify.innerHTML = 'Password too short';
			password_notify.className = 'label label-important';
		} else if(!passwordvalid) {
			password_notify.innerHTML = 'Invalid password';
			password_notify.className = 'label label-important';
		}	else {
			password_notify.innerHTML = 'OK!';
			password_notify.className = 'label label-success';
		}
		
		if(password.value !== password_confirm.value) {
			password_confirm_notify.innerHTML = 'Passwords must match!';
			password_confirm_notify.className = 'label label-important';
			passwordsmatch = false;
		}
	});
	
	$(password_confirm).on('keyup', function() {
		if(password.value !== password_confirm.value) {
			password_confirm_notify.innerHTML = 'Passwords must match!';
			password_confirm_notify.className = 'label label-important';
			passwordsmatch = false;
		}
		else {
			password_confirm_notify.innerHTML = 'OK!';
			password_confirm_notify.className = 'label label-success';
			passwordsmatch = true;
		}
	});

	ajaxify.register_events(['user.exists', 'user.email.exists']);

	socket.on('user.exists', function(data) {
		userexists = data.exists;
		if (data.exists === true) {
			username_notify.innerHTML = 'Username exists';
			username_notify.className = 'label label-important';
		} else {
			username_notify.innerHTML = 'OK!';
			username_notify.className = 'label label-success';
		}
	});
	
	socket.on('user.email.exists', function(data) {
		emailexists = data.exists;

		if (data.exists === true) {
			email_notify.innerHTML = 'Email Address exists';
			email_notify.className = 'label label-important';
		}
		else {
			email_notify.innerHTML = 'OK!';
			email_notify.className = 'label label-success';
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

	function validateForm() {
		var validated = true;
		
		if (username.value.length < 2 || !usernamevalid) {
			username_notify.innerHTML = 'Invalid username';
			username_notify.className = 'label label-important';
			validated = false;
		}

		if (password.value.length < 5) {
			password_notify.innerHTML = 'Password too short';
			validated = false;
		} 
		
		if(password.value !== password_confirm.value) {
			password_confirm_notify.innerHTML = 'Passwords must match!';
		}

		if (!emailvalid) {
			email_notify.innerHTML = 'Invalid email address';
			validated = false;
		} 
		
		if(emailexists) {
			email_notify.innerHTML = 'Email Address exists';
			validated = false;
		}

		if(userexists || !passwordsmatch || !passwordvalid)
			validated = false;

		return validated;
	}
	
	register.addEventListener('click', function(e) {
		if (!validateForm()) e.preventDefault();
	}, false);
	
}());

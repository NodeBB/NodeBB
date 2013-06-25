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
		emailexists = false,
		emailvalid = false,
		userexists = false,
		passwordsmatch = false;

	$(username).on('keyup change', function() {
		if (username.value.length > 2) socket.emit('user.exists', {username: username.value});
		else {
			username_notify.innerHTML = 'Username too short';
			username_notify.className = 'label label-important';
		}
	});

	$(emailEl).on('keyup change', function() {
		socket.emit('user.email.exists', { email: emailEl.value });
	});
	
	password.addEventListener('keyup', function() {
		if (password.value.length < 5) {
			password_notify.innerHTML = 'Password too short';
			password_notify.className = 'label label-important';
		} else {
			password_notify.innerHTML = 'OK!';
			password_notify.className = 'label label-success';
		}
	}, false);
	
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
		emailvalid = isEmailValid(email.value);

		if (data.exists === true) {
			email_notify.innerHTML = 'Email Address exists';
			email_notify.className = 'label label-important';
		} else if(!emailvalid) {
			email_notify.innerHTML = 'Invalid email address';
			email_notify.className = 'label label-important';
		}
		else {
			email_notify.innerHTML = 'OK!';
			email_notify.className = 'label label-success';
		}
	});

	// from http://stackoverflow.com/questions/46155/validate-email-address-in-javascript
	function isEmailValid(email) {
	    var re = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;
    	return re.test(email); 
	}

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
		} 

		if (!emailvalid) {
			email_notify.innerHTML = 'Invalid email address';
			validated = false;
		} 
		
		if(emailexists) {
			email_notify.innerHTML = 'Email Address exists';
			validated = false;
		}

		if(userexists)
			validated = false;
			
		if(!passwordsmatch)
			validated = false;

		return validated;
	}
	
	register.addEventListener('click', function(e) {
		if (!validateForm()) e.preventDefault();
	}, false);
	
}());

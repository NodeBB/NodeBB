<h1>Register</h1>
<div class="row-fluid">
	<div class="well {register_window:spansize}">
		<form method="post" action="/register">
			<label for="email">Email Address</label><input type="email" name="email" placeholder="Enter Email Address" id="email" /> <span id="email-notify" class="label label-important"></span> <br />
			<label for="username">Username</label><input type="text" name="username" placeholder="Enter Username" id="username" /> <span id="username-notify" class="label label-success"></span> <br />
			<label for="password">Password</label><input type="password" name="password" placeholder="Enter Password" id="password" /><br />
			<button class="btn btn-primary" id="register" type="submit">Register Now</button>
		</form>
	</div>
	<div class="well span6 {alternate_logins:display}">
		<h4>Alternative Logins</h4>
		<ul class="alt-logins">
			<li data-url="/auth/twitter" class="twitter {twitter:display}"></li>
			<li data-url="/auth/google" class="google {google:display}"></li>
			<li data-url="/auth/facebook" class="facebook {facebook:display}"></li>
		</ul>
	</div>
</div>
<script type="text/javascript">
(function() {
	var username = document.getElementById('username'),
		password = document.getElementById('password'),
		register = document.getElementById('register'),
		emailEl = document.getElementById('email'),
		username_notify = document.getElementById('username-notify'),
		email_notify = document.getElementById('email-notify');

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
		if (e.target.nodeName === 'LI') {
			document.location.href = e.target.getAttribute('data-url');
		}
	});
}());
</script>
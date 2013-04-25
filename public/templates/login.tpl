<h1>Login</h1>
<div class="well">
	<div class="alert alert-error" id="error" style="display:none">
	    <button type="button" class="close" data-dismiss="alert">&times;</button>
	    <strong>Failed Login Attempt</strong> <p></p>
    </div>
	<label>Username</label><input type="text" placeholder="Enter Username" id="username" /><br />
	<label>Password</label><input type="password" placeholder="Enter Password" id="password" /><br />
	<button class="btn btn-primary" id="login" type="submit">Login</button> &nbsp;
	<a href="/reset">Forgot Password?</a>
</div>
<script type="text/javascript">
(function() {
	var username = document.getElementById('username'),
		password = document.getElementById('password'),
		login = document.getElementById('login'),
		error = document.getElementById('error');

	login.onclick = function() {
		socket.emit('user.login', {
			username: username.value,
			password: password.value
		});
	};

	ajaxify.register_events(['user.login']);
	socket.on('user.login', function(data) {
		console.log(data);
		if (data.status === 0) {
			jQuery('#error').show(50);
			jQuery('#error p').html(data.message);
		} else {
			jQuery('#error').hide(50);
			ajaxify.go('/');
		}
	});
}());
</script>
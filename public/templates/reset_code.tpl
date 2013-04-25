<h1>Reset Password</h1>
<div class="well">
	<div class="alert alert-success" id="success" style="display:none">
		<button type="button" class="close" data-dismiss="alert">&times;</button>
		<strong>Password Changed</strong>
		<p>Password successfully reset, please <a href="/login">log in again</a>.</p>
	</div>
	<div class="alert" id="notice" style="display:none">
		<strong></strong>
		<p></p>
	</div>
	<div class="alert alert-error" id="error" style="display:none">
		<strong>Incorrect Reset Code</strong>
		<p>The reset code received was incorrect. Please try again, or <a href="/reset">request a new reset code</a></p>
	</div>
	<div id="reset-form">
		<label for="password">New Password</label><input type="password" placeholder="A new password" id="password" /><br />
		<label for="repeat">... and again</label><input type="password" placeholder="The same password" id="repeat" /><br />
		<button class="btn btn-primary" id="reset" type="submit" disabled>Reset Password</button>
	</div>
</div>
<script type="text/javascript">
(function() {
	var	resetEl = document.getElementById('reset'),
		password = document.getElementById('password'),
		repeat = document.getElementById('repeat'),
		noticeEl = document.getElementById('notice');

	resetEl.addEventListener('click', function() {
		if (password.value.length < 6) {
			$('#error').hide();
			noticeEl.querySelector('strong').innerHTML = 'Invalid Password';
			noticeEl.querySelector('p').innerHTML = 'The password entered it too short, please pick a different password!';
			noticeEl.style.display = 'block';
		} else if (password.value === repeat.value) {
			socket.emit('user:reset.commit', { code: '{reset_code}', password: password.value });
		}
	}, false);

	// Enable the form if the code is valid
	socket.emit('user:reset.valid', { code: '{reset_code}' });


	ajaxify.register_events(['user:reset.valid', 'user:reset.commit']);
	socket.on('user:reset.valid', function(data) {
		if (!!data.valid) resetEl.disabled = false;
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
</script>
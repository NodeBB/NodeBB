<h1>Reset Password</h1>
<div class="well">
	<div class="alert alert-success" id="success" style="display:none">
		<button type="button" class="close" data-dismiss="alert">&times;</button>
		<strong>Password Reset Sent</strong>
		<p></p>
	</div>
	<div class="alert" id="error" style="display:none">
		<button type="button" class="close" data-dismiss="alert">&times;</button>
		<strong>Invalid Email!</strong>
		<p>The email you put in (<span id="invalid-email"></span>) is not registered with us. Please try again.</p>
	</div>
	<label>Email Address</label><input type="text" placeholder="Enter Email Address" id="email" /><br />
	<button class="btn btn-primary" id="reset" type="submit">Reset Password</button>
</div>
<script type="text/javascript">
(function() {
	document.getElementById('reset').onclick = function() {
		socket.emit('user.send_reset', { email: document.getElementById('email').value });
	};

	socket.on('user.send_reset', function(data) {
		var	inputEl = document.getElementById('email'),
			submitEl = document.getElementById('reset'),
			invalidEl = document.getElementById('invalid-email');

		if (data.status === 'ok') {
			jQuery('#error').hide();
			jQuery('#success').show();
			jQuery('#success p').html('An email has been dispatched to "' + data.email + '" with instructions on setting a new password.');
			inputEl.value = '';
		} else {
			jQuery('#success').hide();
			jQuery('#error').show();
			invalidEl.innerHTML = data.email;
		}
	});
}());
</script>
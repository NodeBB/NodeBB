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
		<p></p>
	</div>
	<label for="email">Email Address</label><input type="text" placeholder="Enter Email Address" id="email" /><br />
	<button class="btn btn-primary" id="reset" type="submit">Reset Password</button>
</div>
<script type="text/javascript">
(function() {
	var	inputEl = document.getElementById('email'),
		errorEl = document.getElementById('error'),
		errorTextEl = errorEl.querySelector('p');

	document.getElementById('reset').onclick = function() {
		if (inputEl.value.length > 0 && inputEl.value.indexOf('@') !== -1) {
			socket.emit('user:reset.send', { email: inputEl.value });
		} else {
			jQuery('#success').hide();
			jQuery(errorEl).show();
			errorTextEl.innerHTML = 'Please enter a valid email';
		}
	};

	ajaxify.register_events(['user.send_reset']);
	
	socket.on('user.send_reset', function(data) {
		var	submitEl = document.getElementById('reset');

		if (data.status === 'ok') {
			jQuery('#error').hide();
			jQuery('#success').show();
			jQuery('#success p').html('An email has been dispatched to "' + data.email + '" with instructions on setting a new password.');
			inputEl.value = '';
		} else {
			jQuery('#success').hide();
			jQuery(errorEl).show();
			switch(data.message) {
				case 'invalid-email':
					errorTextEl.innerHTML = 'The email you put in (<span>' + data.email + '</span>) is not registered with us. Please try again.';
				break;
				case 'send-failed':
					errorTextEl.innerHTML = 'There was a problem sending the reset code. Please try again later.';
				break;
			}
		}
	});
}());
</script>
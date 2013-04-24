<h1>Reset Password</h1>
<div class="well">
	<div class="alert alert-success" id="success" style="display:none">
		<button type="button" class="close" data-dismiss="alert">&times;</button>
		<strong>Password Changed</strong>
		<p></p>
	</div>
	<label>New Password</label><input type="password" placeholder="A new password" id="password" /><br />
	<label>... and again</label><input type="password" placeholder="" id="repeat" /><br />
	<input type="hidden" value="{reset_code}" />
	<button class="btn btn-primary" id="reset" type="submit">Reset Password</button>
</div>
<script type="text/javascript">
(function() {
	var	resetEl = document.getElementById('reset'),
		password = document.getElementById('password'),
		repeat = document.getElementById('repeat');

	resetEl.addEventListener('click', function() {
		if (password.value === repeat.value) {
			alert("match");
		}
	}, false);
	// socket.on('user.password.reset', function(data) {
	// 	if (data.success === 'ok') {
	// 		ajaxify.go('/');
	// 	}
	// });
}());
</script>
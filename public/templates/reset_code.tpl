<h1>Reset Password</h1>
<div class="well">
	<div class="alert alert-success" id="success" style="display:none">
		<button type="button" class="close" data-dismiss="alert">&times;</button>
		<strong>Password Changed</strong>
		<p></p>
	</div>
	<label>New Password</label><input type="password" placeholder="A new password" id="password" /><br />
	<label>... and again</label><input type="password" placeholder="" id="password_2" /><br />
	<input type="hidden" value="{andrew - the code goes here}" />
	<button class="btn btn-primary" id="reset" type="submit">Reset Password</button>
</div>
<script type="text/javascript">
(function() {
	var	resetEl = document.getElementById('reset');

	resetEl.addEventListener('click', function() {

	}, false);
	// socket.on('user.password.reset', function(data) {
	// 	if (data.success === 'ok') {
	// 		ajaxify.go('/');
	// 	}
	// });
}());
</script>
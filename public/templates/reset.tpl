<h1>Reset Password</h1>
<div class="well">
	<div class="alert alert-success" id="success" style="display:none">
	    <button type="button" class="close" data-dismiss="alert">&times;</button>
	    <strong>Password Reset Sent</strong>
	    <p>An email has been dispatched to <span id="reset-email"></span> with instructions on setting a new password.</p>
    </div>
	<label>Email Address</label><input type="text" placeholder="Enter Email Address" id="email" /><br />
	<button class="btn btn-primary" id="login" type="submit">Reset Password</button>
</div>
<script type="text/javascript">
(function() {
	/*socket.on('user.login', function(data) {
		console.log(data);
		if (data.status === 0) {
			jQuery('#error').show(50);
			jQuery('#error p').html(data.message);
		} else {
			alert('success');
			jQuery('#error').hide(50);
		}
	});*/
}());
</script>
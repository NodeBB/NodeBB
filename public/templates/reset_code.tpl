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
<input type="hidden" template-variable="reset_code" value="{reset_code}" />


<script type="text/javascript" src="{relative_path}/src/forum/reset_code.js"></script>
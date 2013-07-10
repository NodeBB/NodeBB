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

<script type="text/javascript" src="{relative_path}/src/forum/reset.js"></script>
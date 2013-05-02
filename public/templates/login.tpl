<h1>Login</h1>
<div class="well">
	<div class="alert alert-error" id="error" style="display:none">
	    <button type="button" class="close" data-dismiss="alert">&times;</button>
	    <strong>Failed Login Attempt</strong> <p></p>
    </div>
	<form method="post" action="/login">
		<label>Username</label><input type="text" placeholder="Enter Username" name="username" id="username" /><br />
		<label>Password</label><input type="password" placeholder="Enter Password" name="password" id="password" /><br />
		<button class="btn btn-primary" id="login" type="submit">Login</button> &nbsp;
	</form>
	<a href="/reset">Forgot Password?</a>
</div>
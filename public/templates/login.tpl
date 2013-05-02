<h1>Login</h1>
<div class="row-fluid">
	<div class="well span6">
		<h4>Login via Username &amp; Password</h4>
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
	<div class="well span6">
		<h4>Alternative Logins</h4>
		<ul class="alt-logins">
			<li><a href="/auth/twitter"><img src="/images/twitter_login.png" /></a></li>
		</ul>
	</div>
</div>
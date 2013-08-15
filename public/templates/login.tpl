<h1>Login</h1>
<div class="row-fluid">
	<div class="well {login_window:spansize}">
		<h4>Login via Username &amp; Password</h4>
		<div class="alert alert-error" id="error" style="display:none">
			<button type="button" class="close" data-dismiss="alert">&times;</button>
			<strong>Failed Login Attempt</strong> <p></p>
		</div>
		
		<form>
			<label>Username</label><input type="text" placeholder="Enter Username" name="username" id="username" /><br />
			<label>Password</label><input type="password" placeholder="Enter Password" name="password" id="password" /><br />
			<input type="hidden" name="_csrf" value="{token}" id="csrf-token" />
			<button class="btn btn-primary" id="login" type="submit">Login</button> &nbsp; <a href="/reset">Forgot Password?</a>
		</form>
		
		<div id="login-error-notify" class="alert alert-danger hide">Invalid username/password</div>
	</div>
	
	<div class="well span6 {alternate_logins:display}">
		<h4>Alternative Logins</h4>
		<ul class="alt-logins">
			<li data-url="/auth/twitter" class="twitter {twitter:display}"><i class="icon-twitter-sign icon-3x"></i></li>
			<li data-url="/auth/google" class="google {google:display}"><i class="icon-google-plus-sign icon-3x"></i></li>
			<li data-url="/auth/facebook" class="facebook {facebook:display}"><i class="icon-facebook-sign icon-3x"></i></li>
		</ul>
	</div>
</div>

<script type="text/javascript" src="{relative_path}/src/forum/login.js"></script>
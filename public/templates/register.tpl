<h1>Register</h1>
<div class="row-fluid">
	<div class="well {register_window:spansize}">
		<form method="post" action="#">
			<fieldset>
				<label for="email"><strong>Email Address</strong></label>
				<input type="email" name="email" placeholder="Enter Email Address" id="email" autofocus/>
				<span id="email-notify" class="alert alert-error hide"></span>
				<span class="help-block">Your email won't be shown to the public unless you want.</span>
				
				<label for="username"><strong>Username</strong></label>
				<input type="text" name="username" placeholder="Enter Username" id="username" />
				<span id="username-notify" class="alert alert-error hide"></span>
				<span class="help-block">A unique username. {minimumUsernameLength}-{maximumUsernameLength} characters. Others can mention you with @username.</span>
				
				<label for="password"><strong>Password</strong></label>
				<input type="password" name="password" placeholder="Enter Password" id="password" />
				<span id="password-notify" class="alert alert-error hide"></span>
				<span class="help-block">{minimumPasswordLength}-{maximumPasswordLength} characters.</span>
				
				<label for="password-confirm"><strong>Confirm Password</strong></label>
				<input type="password" name="password-confirm" placeholder="Confirm Password" id="password-confirm" />
				<span id="password-confirm-notify" class="alert alert-error hide"></span>
				
				<input type="hidden" name="_csrf" value="{token}" />
				<br/>
				<button class="btn btn-primary" id="register" type="submit">Register Now</button>
			</fieldset>
		</form>
	</div>
	<div class="well span6 {alternate_logins:display}">
		<h4>Alternative Registration</h4>
		<ul class="alt-logins">
			<li data-url="/auth/twitter" class="twitter {twitter:display}"><i class="icon-twitter-sign icon-3x"></i></li>
			<li data-url="/auth/google" class="google {google:display}"><i class="icon-google-plus-sign icon-3x"></i></li>
			<li data-url="/auth/facebook" class="facebook {facebook:display}"><i class="icon-facebook-sign icon-3x"></i></li>
		</ul>
	</div>
</div>

<script type="text/javascript" src="{relative_path}/src/forum/register.js"></script>
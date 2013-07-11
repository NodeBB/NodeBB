<h1>Register</h1>
<div class="row-fluid">
	<div class="well {register_window:spansize}">
		<form method="post" action="{relative_path}/register">
			<label for="email">Email Address</label><input type="email" name="email" placeholder="Enter Email Address" id="email" /> <span id="email-notify" class="label label-important"></span><br />
			<label for="username">Username</label><input type="text" name="username" placeholder="Enter Username" id="username" /> <span id="username-notify" class="label label-success"></span> <br />
			<label for="password">Password</label><input type="password" name="password" placeholder="Enter Password" id="password" /> <span id="password-notify" class="label label-important"></span> <br />
			<label for="password-confirm">Confirm Password</label><input type="password" name="password-confirm" placeholder="Confirm Password" id="password-confirm" /> <span id="password-confirm-notify" class="label label-important"></span> <br />
			<input type="hidden" name="_csrf" value="{token}" />
			<button class="btn btn-primary" id="register" type="submit">Register Now</button>
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
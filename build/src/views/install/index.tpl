<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>NodeBB Web Installer</title>

	<link rel="stylesheet" type="text/css" href="bootstrap.min.css">
	<link rel="stylesheet" type="text/css" href="installer.css">

	<script type="text/javascript" async defer src="/assets/installer.min.js"></script>
</head>

<body>
	<nav class="navbar navbar-expand-lg bg-light">
		<div class="container-fluid">
			<a class="navbar-brand" href="#">NodeBB</a>
			<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbar-menu" aria-controls="navbar-menu" aria-expanded="false" aria-label="Toggle navigation">
				<span class="navbar-toggler-icon"></span>
			</button>
			<div class="collapse navbar-collapse" id="navbar-menu">
				<ul class="navbar-nav me-auto mb-2 mb-lg-0">
					<li class="nav-item"><a class="nav-link active" href="/">Installer</a></li>
					<li class="nav-item"><a class="nav-link" href="https://docs.nodebb.org" target="_blank">Get Help</a></li>
					<li class="nav-item"><a class="nav-link" href="https://community.nodebb.org" target="_blank">Community</a></li>
				</ul>
			</div>
		</div>
	</nav>
	{{{ if !installing }}}
	<div class="container {{{ if success }}}hide{{{ end }}}">
		<p>
			<h1>Welcome to the NodeBB Installer</h1>
			You are just a few steps away from launching your own NodeBB forum!
		</p>
		<form id="install" action="/" method="post" autocomplete="off">
			{{{ if !skipGeneralSetup }}}
			<div class="general">
				<p>
					<h2><small>General Instance Setup</small></h2>
					<hr />
				</p>

				<div class="row input-row">
					<div class="col-sm-7 col-12 input-field">
						<label class="form-label" for="install:url">Web Address (URL)</label>
						<input id="install:url" type="text" class="form-control" name="url" value="{{{ if url }}}{url}{{{ end }}}" placeholder="http://localhost:4567" />
					</div>
					<div class="col-sm-5 form-text" data-help="This is the address that resolves to your NodeBB forum. If no port is specified, <code>4567</code> will be used."></div>
				</div>
			</div>
			{{{ end }}}
			<div class="admin">
				<p>
					<h2><small>Create an Administrator account</small></h2>
					<hr />
				</p>

				<div class="row input-row">
					<div class="col-sm-7 col-12 input-field">
						<label class="form-label" for="admin:username">Username</label>
						<input id="admin:username" type="text" class="form-control" name="admin:username" value="{{{ if admin:username }}}{admin:username}{{{ end }}}" placeholder="Username" autocomplete="off"/>
					</div>
					<div class="col-sm-5 form-text" data-help="Enter an <strong>alphanumeric username</strong>. Spaces between words are allowed. You can always change your username later on your profile page."></div>
				</div>
				<div class="row input-row">
					<div class="col-sm-7 col-12 input-field">
						<label class="form-label" for="admin:email">Email Address</label>
						<input id="admin:email" type="text" class="form-control" name="admin:email" value="{{{ if admin:email }}}{admin:email}{{{ end }}}" placeholder="Email Address" autocomplete="off" />
					</div>
					<div class="col-sm-5 form-text" data-help="Please enter your email address."></div>
				</div>
				<div class="row input-row">
					<div class="col-sm-7 col-12 input-field">
						<label class="form-label" for="admin:password">Password</label>
						<input id="admin:password" type="password" class="form-control" name="admin:password" value="{{{ if admin:password }}}{admin:password}{{{ end }}}" placeholder="Password" data-minimum-strength="{minimumPasswordStrength}" data-minimum-length="{minimumPasswordLength}" autocomplete="off"/>
					</div>
					<div class="col-sm-5 form-text" data-help="Use a combination of numbers, symbols, and different cases. You can change the strictness of password creation in the Admin Control Panel. Minimum {minimumPasswordLength} characters."></div>
				</div>
				<div class="row input-row">
					<div class="col-sm-7 col-12 input-field">
						<label class="form-label" for="admin:passwordConfirm">Confirm Password</label>
						<input id="admin:passwordConfirm" type="password" class="form-control" name="admin:passwordConfirm" value="{{{ if admin:passwordConfirm }}}{admin:passwordConfirm}{{{ end }}}" placeholder="Confirm Password" autocomplete="off"/>
					</div>
					<div class="col-sm-5 form-text" data-help="Please confirm your password."></div>
				</div>
			</div>

			{{{ if error }}}
			<a id="database-error"></a>
			{{{ end }}}

			{{{ if !skipDatabaseSetup }}}
			<div class="database">
				<p>
					<h2><small>Configure your database</small></h2>
					<hr />
				</p>

				<div class="row input-row">
					<div class="col-sm-7 col-12 input-field">
						<label class="form-label" for="install:database">Database Type</label>
						<select id="install:database" class="form-select" name="database">
							<option value="mongo">MongoDB</option>
							<option value="redis">Redis</option>
							<option value="postgres">PostgreSQL</option>
						</select>
					</div>
					<div class="col-sm-5 form-text" data-help="Leave the fields blank to use the default settings.">{{{ if error }}}There was an error connecting to your database. Please try again.{{{ end }}}</div>
				</div>

				<div id="database-config"></div>
			</div>
			{{{ end }}}

			<button id="submit" type="submit" class="btn btn btn-success">Install NodeBB <i class="working hide"></i></button>
		</form>
	</div>
	{{{ end }}}

	{{{ if installing }}}
	<div id="installing" class="container">
		<p>
			<h1>Hang tight! Your NodeBB is being installed.</h1>
		</p>
	</div>
	{{{ end }}}

	<div class="container {{{ if !success }}}hide{{{ end }}}">
		<p>
			<h1>Congratulations! Your NodeBB has been set-up.</h1>

			<button id="launch" data-url="{launchUrl}" class="btn btn btn-success">Launch NodeBB <i class="working hide"></i></button>
		</p>
	</div>

	<div class="hide">
		{{{ each databases }}}
		<div data-database="{databases.name}">
			 {{{ each databases.questions }}}
				<div class="row input-row">
					<div class="col-sm-7 col-12 input-field">
						<label class="form-label" for="{databases.questions.name}">{databases.questions.description}</label>
						<input id="{databases.questions.name}" type="{{{ if hidden }}}password{{{ else }}}text{{{ end }}}" class="form-control" name="{databases.questions.name}" placeholder="{databases.questions.default}" value="{databases.questions.default}" />
					</div>
				</div>
			{{{ end }}}
		</div>
		{{{ end }}}
	</div>
</body>
</html>
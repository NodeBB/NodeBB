<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>NodeBB Web Installer</title>

	<link rel="stylesheet" type="text/css" href="bootstrap.min.css">
	<link rel="stylesheet" type="text/css" href="installer.css">

	<script type="text/javascript" async defer src="installer.min.js"></script>
</head>

<body>
	<nav class="navbar navbar-default">
		<div class="container-fluid">
			<div class="navbar-header">
				<a class="navbar-brand" href="#">NodeBB</a>
			</div>

			<ul class="nav navbar-nav">
				<li class="active"><a href="/">Installer</a></li>
				<li><a href="https://docs.nodebb.org" target="_blank">Get Help</a></li>
				<li><a href="https://community.nodebb.org" target="_blank">Community</a></li>
			</ul>
		</div>
	</nav>
	<!-- IF !installing -->
	<div class="container <!-- IF success -->hide<!-- ENDIF success -->">
		<p>
			<h1>Welcome to the NodeBB Installer</h1>
			You are just a few steps away from launching your own NodeBB forum!
		</p>
		<form id="install" action="/" method="post">
			<!-- IF !skipGeneralSetup -->
			<div class="general">
				<p>
					<h1><small>General Instance Setup</small></h1>
					<hr />
				</p>

				<div class="row input-row">
					<div class="col-sm-7 col-xs-12 input-field">
						<label for="url">Web Address (URL)</label>
						<input type="text" class="form-control" name="url" value="<!-- IF url -->{url}<!-- ENDIF url -->" placeholder="http://localhost:4567" />
					</div>
					<div class="col-sm-5 help-text" data-help="This is the address that resolves to your NodeBB forum. If no port is specified, <code>4567</code> will be used."></div>
				</div>
			</div>
			<!-- END -->
			<div class="admin">
				<p>
					<h1><small>Create an Administrator account</small></h1>
					<hr />
				</p>

				<div class="row input-row">
					<div class="col-sm-7 col-xs-12 input-field">
						<label for="admin:username">Username</label>
						<input type="text" class="form-control" name="admin:username" value="<!-- IF admin:username -->{admin:username}<!-- ENDIF admin:username -->" placeholder="Username" />
					</div>
					<div class="col-sm-5 help-text" data-help="Enter an <strong>alphanumeric username</strong>. Spaces between words are allowed. You can always change your username later on your profile page."></div>
				</div>
				<div class="row input-row">
					<div class="col-sm-7 col-xs-12 input-field">
						<label for="admin:email">Email Address</label>
						<input type="text" class="form-control" name="admin:email" value="<!-- IF admin:email -->{admin:email}<!-- ENDIF admin:email -->" placeholder="Email Address" />
					</div>
					<div class="col-sm-5 help-text" data-help="Please enter your email address."></div>
				</div>
				<div class="row input-row">
					<div class="col-sm-7 col-xs-12 input-field">
						<label for="admin:password">Password</label>
						<input type="password" class="form-control" name="admin:password" value="<!-- IF admin:password -->{admin:password}<!-- ENDIF admin:password -->" placeholder="Password" data-minimum-length="{minimumPasswordLength}" />
					</div>
					<div class="col-sm-5 help-text" data-help="Use a combination of numbers, symbols, and different cases. You can change the strictness of password creation in the Admin Control Panel. Minimum {minimumPasswordLength} characters."></div>
				</div>
				<div class="row input-row">
					<div class="col-sm-7 col-xs-12 input-field">
						<label for="admin:passwordConfirm">Confirm Password</label>
						<input type="password" class="form-control" name="admin:passwordConfirm" value="<!-- IF admin:passwordConfirm -->{admin:passwordConfirm}<!-- ENDIF admin:passwordConfirm -->" placeholder="Confirm Password" />
					</div>
					<div class="col-sm-5 help-text" data-help="Please confirm your password."></div>
				</div>
			</div>

			<!-- IF error -->
			<a id="database-error"></a>
			<!-- ENDIF error -->

			<!-- IF !skipDatabaseSetup -->
			<div class="database">
				<p>
					<h1><small>Configure your database</small></h1>
					<hr />
				</p>

				<div class="row input-row">
					<div class="col-sm-7 col-xs-12 input-field">
						<label for="database">Database Type</label>
						<select class="form-control" name="database">
							<option value="redis">Redis</option>
							<option value="mongo">MongoDB</option>
							<option value="postgres">PostgreSQL</option>
						</select>
					</div>
					<div class="col-sm-5 help-text" data-help="Leave the fields blank to use the default settings."><!-- IF error -->There was an error connecting to your database. Please try again.<!-- ENDIF error --></div>
				</div>

				<div id="database-config"></div>
			</div>
			<!-- ENDIF !skipDatabaseSetup -->

			<button id="submit" type="submit" class="btn btn-lg btn-success">Install NodeBB <i class="working hide"></i></button>
		</form>
	</div>
	<!-- ENDIF !installing -->

	<!-- IF installing -->
	<div id="installing" class="container">
		<p>
			<h1>Hang tight! Your NodeBB is being installed.</h1>
		</p>
	</div>
	<!-- ENDIF installing -->

	<div class="container <!-- IF !success -->hide<!-- ENDIF !success -->">
		<p>
			<h1>Congratulations! Your NodeBB has been set-up.</h1>

			<button id="launch" data-url="{launchUrl}" class="btn btn-lg btn-success">Launch NodeBB <i class="working hide"></i></button>
		</p>
	</div>

	<div class="hide">
		<!-- BEGIN databases -->
		<div data-database="{databases.name}">
			<!-- BEGIN questions -->
				<div class="row input-row">
					<div class="col-sm-7 col-xs-12 input-field">
						<label for="{databases.questions.name}">{databases.questions.description}</label>
						<input type="<!-- IF hidden -->password<!-- ELSE -->text<!-- ENDIF hidden -->" class="form-control" name="{databases.questions.name}" placeholder="{databases.questions.default}" value="{databases.questions.default}" />
					</div>
				</div>
			<!-- END questions -->
		</div>
		<!-- END databases -->
	</div>
</body>
</html>
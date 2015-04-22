<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
	<title>NodeBB Web Installer</title>

	<link rel="stylesheet" type="text/css" href="https://bootswatch.com/united/bootstrap.min.css">
	<link href='http://fonts.googleapis.com/css?family=Roboto:400,300,500,700' rel='stylesheet' type='text/css'>
	<link rel="stylesheet" type="text/css" href="stylesheet.css">


	<!--[if lt IE 9]>
  		<script src="//cdnjs.cloudflare.com/ajax/libs/es5-shim/2.3.0/es5-shim.min.js"></script>
  		<script src="//cdnjs.cloudflare.com/ajax/libs/html5shiv/3.7/html5shiv.js"></script>
  		<script src="//cdnjs.cloudflare.com/ajax/libs/respond.js/1.4.2/respond.js"></script>
  		<script>__lt_ie_9__ = 1;</script>
	<![endif]-->
</head>

<body>
	<nav class="navbar navbar-default">
		<div class="container-fluid">
			<div class="navbar-header">
				<button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#bs-example-navbar-collapse-1">
					<span class="sr-only">Toggle navigation</span>
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
				</button>
				<a class="navbar-brand" href="#">NodeBB</a>
			</div>

			<div class="collapse navbar-collapse" id="bs-example-navbar-collapse-1">
				<ul class="nav navbar-nav">
					<li class="active"><a href="/">Installer</a></li>
					<li><a href="https://docs.nodebb.org" target="_blank">Get Help</a></li>
					<li><a href="https://community.nodebb.org" target="_blank">Community</a></li>
				</ul>
			</div>
		</div>
	</nav>

	<div class="container">
		<p>
			<h1>Welcome to the NodeBB Installer</h1>
			You are just a few steps away from launching your own NodeBB forum!
		</p>
		<form action="/" method="post">
			<p>
				<h1><small>Create an Administrator account</small></h1>
				<hr />
			</p>
			<div class="row input-row">
				<div class="col-sm-7 col-xs-12 input-field">
					<label for="admin:username">Username</label>
					<input type="text" class="form-control" name="admin:username" placeholder="Username" />
				</div>
				<div class="col-sm-5 help-text" data-help="Enter an <strong>alphanumeric username</strong>. Spaces between words are allowed. You can always change your username later on your profile page."></div>
			</div>
			<div class="row input-row">
				<div class="col-sm-7 col-xs-12 input-field">
					<label for="admin:email">Email Address</label>
					<input type="text" class="form-control" name="admin:email" placeholder="Email Address" />
				</div>
				<div class="col-sm-5 help-text" data-help="Please enter your email address."></div>
			</div>
			<div class="row input-row">
				<div class="col-sm-7 col-xs-12 input-field">
					<label for="admin:password">Password</label>
					<input type="password" class="form-control" name="admin:password" placeholder="Password" />
				</div>
				<div class="col-sm-5 help-text" data-help="Use a combination of numbers, symbols, and different cases. You can change the strictness of password creation in the Admin Control Panel."></div>
			</div>
			<div class="row input-row">
				<div class="col-sm-7 col-xs-12 input-field">
					<label for="admin:password:confirm">Confirm Password</label>
					<input type="password" class="form-control" name="admin:password:confirm" placeholder="Confirm Password" />
				</div>
				<div class="col-sm-5 help-text" data-help="Please confirm your password."></div>
			</div>

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
					</select>
				</div>
			</div>

			<div id="database-config"></div>

			<button type="submit" class="btn btn-lg btn-success">Install NodeBB</button>
		</form>
	</div>

	<div class="hide">
		<!-- BEGIN databases -->
		<div data-database="{databases.name}">
			<!-- BEGIN questions -->
				<div class="row input-row">
					<div class="col-sm-7 col-xs-12 input-field">
						<label for="{databases.questions.name}">{databases.questions.description}</label>
						<input type="<!-- IF hidden -->password<!-- ELSE -->text<!-- ENDIF hidden -->" class="form-control" name="{databases.questions.name}" placeholder="{databases.questions.default}" />
					</div>
				</div>
			<!-- END questions -->
		</div>
		<!-- END databases -->			
	</div>

	<script src="//code.jquery.com/jquery-1.11.2.min.js"></script>
	<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/js/bootstrap.min.js"></script>
	<script type="text/javascript" src="nodebb.min.js"></script>
</body>
</html>
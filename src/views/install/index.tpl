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
					<li><a href="#">Get Help</a></li>
					<li><a href="#">Community</a></li>
				</ul>
			</div>
		</div>
	</nav>

	<div class="container">
		<p>
			<h1>Welcome to the NodeBB Installer! <hr /><small>You are just a few steps away from launching your own NodeBB forum</small></h1>
		</p>
		<br />
		<form>
			<div class="row input-row">
				<div class="col-sm-8 col-xs-12 input-field">
					<label for="username">Username</label>
					<input type="text" class="form-control" name="username" placeholder="Username" />	
				</div>
				<div class="col-sm-4 help-text" data-help="<strong>Enter an alphanumeric username. Spaces between words are allowed.</strong> You can always change your username later on your profile page."></div>
			</div>
			<div class="row input-row">
				<div class="col-sm-8 col-xs-12 input-field">
					<label for="password">Password</label>
					<input type="password" class="form-control" name="password" placeholder="Username" />	
				</div>
				<div class="col-sm-4 help-text" data-help="Here is some sample help text. Username should be between <strong>6</strong> and <strong>12</strong> characters long."></div>
			</div>
		</form>
	</div>

	<script src="//code.jquery.com/jquery-1.11.2.min.js"></script>
	<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/js/bootstrap.min.js"></script>
	<script type="text/javascript" src="nodebb.min.js"></script>
</body>
</html>
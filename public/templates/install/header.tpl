<!DOCTYPE html>
<html>
<head>
	<title>NodeBB</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta name="title" CONTENT="NodeBB">
	<meta name="description" content="Node.js/Redis/Socket.io powered forums for a new generation">
	<link href="/vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet" media="screen">
	<link href="/vendor/bootstrap/css/bootstrap-responsive.min.css" rel="stylesheet" media="screen">
	<link rel="stylesheet" href="/vendor/fontawesome/css/font-awesome.min.css">
	<script type="text/javascript" src="http://code.jquery.com/jquery.js"></script>
	<script type="text/javascript" src="/vendor/jquery/js/jquery-ui-1.10.3.custom.min.js"></script>
	<script type="text/javascript" src="/vendor/bootstrap/js/bootstrap.min.js"></script>
	<script type="text/javascript" src="/socket.io/socket.io.js"></script>
	<script type="text/javascript" src="/src/app.js"></script>
	<script type="text/javascript" src="/src/templates.js"></script>
	<script type="text/javascript" src="/src/ajaxify.js"></script>
	<script type="text/javascript" src="/src/jquery.form.js"></script>
	<script type="text/javascript" src="/src/utils.js"></script>

	<link rel="stylesheet" type="text/css" href="/css/style.css" />
</head>

<body>
	<div class="navbar navbar-inverse navbar-fixed-top">
		<div class="navbar-inner">
			<div class="container">
				<a class="brand" href="/install">NodeBB Installation</a>
				<button type="button" class="btn btn-navbar" data-toggle="collapse" data-target=".nav-collapse">
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
				</button>
				<div class="nav-collapse collapse">
					<ul class="nav nodebb-inline-block">
						<li>
							<a data-tab="email" href="/install/email"><i class="icon-envelope"></i> Mail</a>
						</li>
						<li>
							<a data-tab="social" href="/install/social"><i class="icon-facebook"></i> Social</a>
						</li>
						<li>
							<a data-tab="privileges" href="/install/privileges"><i class="icon-legal"></i> Privileges</a>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
	<div id="alert_window"></div>

	<div class="container" id="content">
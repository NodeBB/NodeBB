<!DOCTYPE html>
<html>
<head>
	<title>{title}</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta name="title" CONTENT="NodeBB">
	<meta name="keywords" content="" />
	<meta name="description" content="{meta.description}" />
	<meta http-equiv="content-type" content="text/html; charset=UTF-8" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<link href="{cssSrc}" rel="stylesheet" media="screen">
	<link href="{relative_path}/vendor/bootstrap/css/bootstrap-responsive.min.css" rel="stylesheet" media="screen">
	<link rel="stylesheet" href="{relative_path}/vendor/fontawesome/css/font-awesome.min.css">
	<script>
		var RELATIVE_PATH = "{relative_path}";
	</script>
	<script type="text/javascript" src="http://code.jquery.com/jquery.js"></script>
	<script type="text/javascript" src="{relative_path}/vendor/jquery/js/jquery-ui-1.10.3.custom.min.js"></script>
	<script type="text/javascript" src="{relative_path}/vendor/bootstrap/js/bootstrap.min.js"></script>
	<script type="text/javascript" src="{relative_path}/socket.io/socket.io.js"></script>
	<script type="text/javascript" src="{relative_path}/src/app.js"></script>
	<script src="{relative_path}/vendor/requirejs/require.js"></script>
	<script src="{relative_path}/vendor/bootbox/bootbox.min.js"></script>
	<script>
		require.config({
			baseUrl: "{relative_path}/src/modules",
			waitSeconds: 3
		});
	</script>
	<script type="text/javascript" src="{relative_path}/src/templates.js"></script>
	<script type="text/javascript" src="{relative_path}/src/ajaxify.js"></script>
	<script type="text/javascript" src="{relative_path}/src/jquery.form.js"></script>
	<script type="text/javascript" src="{relative_path}/src/utils.js"></script>

	<link rel="stylesheet" type="text/css" href="{relative_path}/css/nodebb.css" />


</head>

<body>
	<div id="mobile-menu-overlay">
	</div>
	<div class="navbar navbar-inverse navbar-fixed-top" id="header-menu">
		<div class="navbar-inner">
			<div class="container">
				<a class="brand" href="/">{title}</a>
				<button type="button" class="btn btn-navbar" data-toggle="collapse" data-target=".nav-collapse">
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
				</button>
				<div class="nav-collapse collapse">
					<ul class="nav nodebb-inline-block">
						<li>
							<a href="/recent">Recent <!--<span class="badge badge-inverse">3</span>--></a>
						</li>
						<!--<li>
							<a href="/popular">Popular</a>
						</li>
						<li>
							<a href="/active">Active</a>
						</li>-->
						<li>
							<a href="/users">Users</a>
						</li>
					</ul>
					<ul id="right-menu" class="nav pull-right nodebb-inline-block">
						<li class="notifications dropdown text-center">
							<a class="dropdown-toggle" data-toggle="dropdown" href="#" id="notif_dropdown"><i class="icon-circle-blank"></i></a>
							<ul id="notif-list" class="dropdown-menu" aria-labelledby="notif_dropdown">
								<li><a href="#"><i class="icon-refresh icon-spin"></i> Loading Notifications</a></li>
							</ul>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
	
	<input id="csrf_token" type="hidden" template-variable="csrf" value="{csrf}" />

	
	<div class="container" id="content">


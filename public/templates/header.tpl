<!DOCTYPE html>
<html>
<head>
	<title>{browserTitle}</title>
	{meta_tags}
	<link href="{cssSrc}" rel="stylesheet" media="screen">
	<link rel="stylesheet" href="{relative_path}/vendor/fontawesome/css/font-awesome.min.css">
	<script>
		var RELATIVE_PATH = "{relative_path}";
	</script>
	<script src="http://code.jquery.com/jquery.js"></script>
	<script src="{relative_path}/vendor/jquery/js/jquery-ui-1.10.3.custom.min.js"></script>
	<script src="{relative_path}/vendor/bootstrap/js/bootstrap.min.js"></script>
	<script src="{relative_path}/socket.io/socket.io.js"></script>
	<script src="{relative_path}/src/app.js"></script>
	<script src="{relative_path}/vendor/requirejs/require.js"></script>
	<script src="{relative_path}/vendor/bootbox/bootbox.min.js"></script>
	<script>
		require.config({
			baseUrl: "{relative_path}/src/modules",
			waitSeconds: 3
		});
	</script>
	<script src="{relative_path}/src/templates.js"></script>
	<script src="{relative_path}/src/ajaxify.js"></script>
	<script src="{relative_path}/src/jquery.form.js"></script>
	<script src="{relative_path}/src/utils.js"></script>

	<link rel="stylesheet" type="text/css" href="{relative_path}/css/nodebb.css" />

</head>

<body>
	<!--<div id="mobile-menu-overlay"> disabling until this can be pluginified.
	</div>-->

	<div class="navbar navbar-inverse navbar-fixed-top" id="header-menu">
		<div class="container">
			<div class="navbar-header">
				<button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
		            <span class="icon-bar"></span>
		            <span class="icon-bar"></span>
		            <span class="icon-bar"></span>
		        </button>
		        <a class="navbar-brand" href="/">{title}</a>
		    </div>

			<div class="navbar-collapse collapse">
				<ul id="main-nav" class="nav navbar-nav">
					<li>
						<a href="/recent">Recent</a>
					</li>
					<li class="nodebb-loggedin">
						<a href="/unread"><span id="numUnreadBadge" class="badge badge-inverse">0</span> Unread</a>
					</li>
					<li>
						<a href="/users">Users</a>
					</li>
					<li>
						<a href="/"></a>
					</li>
				</ul>


				<ul id="right-menu" class="nav navbar-nav pull-right">
					<li class="notifications dropdown text-center">
						<a class="dropdown-toggle" data-toggle="dropdown" href="#" id="notif_dropdown"><i class="icon-circle-blank"></i></a>
						<ul id="notif-list" class="dropdown-menu" aria-labelledby="notif_dropdown">
							<li><a href="#"><i class="icon-refresh icon-spin"></i> Loading Notifications</a></li>
						</ul>
					</li>
					<li>
						<form id="search-form" class="form-search form-inline visible-md visible-lg" action="" method="GET">
							<input type="text" name="query" class="form-control search-query" />
							<button type="submit" class="btn hide">Search</button>
						</form>
					</li>
				</ul>
				<div id="pagination"></div>
			</div>
		</div>
	</div>

	<input id="csrf_token" type="hidden" template-variable="csrf" value="{csrf}" />


	<div class="container" id="content">


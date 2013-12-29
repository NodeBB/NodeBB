<!DOCTYPE html>
<html>
<head>
	<title>NodeBB Administration Panel</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<script>
		var RELATIVE_PATH = "{relative_path}";
	</script>
	<link id="base-theme" href="{relative_path}/vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet" media="screen">
	<link rel="stylesheet" href="{relative_path}/vendor/fontawesome/css/font-awesome.min.css">
	<script type="text/javascript" src="http://code.jquery.com/jquery.js"></script>
	<script type="text/javascript" src="{relative_path}/vendor/bootstrap/js/bootstrap.min.js"></script>
	<script type="text/javascript" src="http://code.jquery.com/qunit/qunit-git.js"></script>
	<link rel="stylesheet" type="text/css" href="http://code.jquery.com/qunit/qunit-git.css">
	<link rel="stylesheet" type="text/css" href="{relative_path}/vendor/colorpicker/colorpicker.css">
	<script type="text/javascript" src="{relative_path}/socket.io/socket.io.js"></script>
	<script type="text/javascript" src="{relative_path}/src/app.js"></script>
	<script type="text/javascript" src="{relative_path}/src/templates.js"></script>
	<script type="text/javascript" src="{relative_path}/src/translator.js"></script>
	<script type="text/javascript" src="{relative_path}/src/ajaxify.js"></script>
	<script src="{relative_path}/vendor/jquery/js/jquery.timeago.js"></script>
	<script src="{relative_path}/vendor/jquery/js/jquery.form.js"></script>
	<script src="{relative_path}/vendor/requirejs/require.js"></script>
	<script src="{relative_path}/vendor/bootbox/bootbox.min.js"></script>
	<script src="{relative_path}/vendor/colorpicker/colorpicker.js"></script>

	<script>
		require.config({
			baseUrl: "{relative_path}/src/modules",
			waitSeconds: 3,
			paths: {
				"forum": '../forum'
			}
		});
	</script>
	<link rel="stylesheet" type="text/css" href="http://code.jquery.com/ui/1.10.3/themes/smoothness/jquery-ui.css">
	<script type="text/javascript" src="http://code.jquery.com/ui/1.10.3/jquery-ui.js"></script>
	<script src="{relative_path}/src/utils.js"></script>

	<link rel="stylesheet" type="text/css" href="{relative_path}/css/theme.css" />
</head>

<body class="admin">
	<div class="navbar navbar-inverse navbar-fixed-top header">
		<div class="container">
			<div class="navbar-header">
				<button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
				</button>
				<a class="navbar-brand" href="/admin/index">NodeBB ACP</a>
			</div>
			<div class="collapse navbar-collapse">
				<ul class="nav navbar-nav">
					<li>
						<a href="/admin/index"><i class="fa fa-home" title="Home"></i></a>
					</li>
					<li>
						<a href="/admin/settings"><i class="fa fa-cogs" title="Settings"></i></a>
					</li>
					<li>
						<a href="/" target="_top"><i class="fa fa-book" title="Forum"></i></a>
					</li>
					<li>
						<a href="#" id="reconnect"></a>
					</li>
				</ul>

				<ul id="logged-in-menu" class="nav navbar-nav navbar-right">
					<li id="user_label" class="dropdown">
						<a class="dropdown-toggle" data-toggle="dropdown" href="#" id="user_dropdown">
							<img src="{userpicture}"/>
						</a>
						<ul id="user-control-list" class="dropdown-menu" aria-labelledby="user_dropdown">
							<li>
								<a id="user-profile-link" href="/user/{userslug}" target="_top"><span>Profile</span></a>
							</li>
							<li id="logout-link">
								<a href="#">Log out</a>
							</li>
						</ul>
					</li>

				</ul>
			</div>
		</div>
	</div>

	<input id="csrf_token" type="hidden" template-variable="csrf" value="{csrf}" />

	<div class="container">
		<div class="row">
			<div class="col-sm-3">
				<div class="well sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header">NodeBB</li>
						<li class='active'>
							<a href='{relative_path}/admin/index'><i class='fa fa-home'></i> Home</a>
						</li>
						<li><a href='{relative_path}/admin/categories/active'><i class='fa fa-folder'></i> Categories</a></li>
						<li><a href='{relative_path}/admin/users/latest'><i class='fa fa-user'></i> Users</a></li>
						<li><a href="{relative_path}/admin/groups"><i class="fa fa-group"></i> Groups</a></li>
						<li><a href='{relative_path}/admin/topics'><i class='fa fa-book'></i> Topics</a></li>
						<li><a href='{relative_path}/admin/themes'><i class='fa fa-th'></i> Themes</a></li>
						<li><a href='{relative_path}/admin/plugins'><i class='fa fa-code-fork'></i> Plugins</a></li>
						<li><a href='{relative_path}/admin/settings'><i class='fa fa-cogs'></i> Settings</a></li>
						<li><a href='{relative_path}/admin/database'><i class='fa fa-hdd-o'></i> Database</a></li>
						<li><a href='{relative_path}/admin/logger'><i class='fa fa-th'></i> Logger</a></li>
						<li><a href="{relative_path}/admin/motd"><i class="fa fa-comment"></i> MOTD</a></li>
						<li><a href="{relative_path}/admin/events"><i class="fa fa-calendar-o"></i> Events</a></li>
					</ul>
				</div>
				<div class="well sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header">Social Authentication</li>
						<li><a href='{relative_path}/admin/twitter'><i class='fa fa-twitter-square'></i> Twitter</a></li>
						<li><a href='{relative_path}/admin/facebook'><i class='fa fa-facebook-square'></i> Facebook</a></li>
						<li><a href='{relative_path}/admin/gplus'><i class='fa fa-google-plus-square'></i> Google+</a></li>
						<!-- BEGIN authentication -->
						<li>
							<a href='{relative_path}/admin{authentication.route}'><i class="fa {authentication.icon}"></i> {authentication.name}</a>
						</li>
						<!-- END authentication -->
					</ul>
				</div>
				<div class="well sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header">Plugins</li>
						<!-- BEGIN plugins -->
						<li>
							<a href='{relative_path}/admin{plugins.route}'><i class="fa {plugins.icon}"></i> {plugins.name}</a>
						</li>
						<!-- END plugins -->
					</ul>
				</div>
				<div class="well sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header">Unit Tests</li>
						<ul class="nav nav-list">
							<li><a href='{relative_path}/admin/testing/categories'>Categories</a></li>
							<!--<li><a href='{relative_path}/admin/testing/topics'>Topics</a></li>
							<li><a href='{relative_path}/admin/testing/posts'>Posts</a></li>
							<li><a href='{relative_path}/admin/testing/accounts'>Accounts</a></li>
							<li><a href='{relative_path}/admin/testing/chat'>Chat</a></li>
							<li><a href='{relative_path}/admin/testing/notifications'>Notifications</a></li>
							<li><a href='{relative_path}/admin/testing/friends'>Friends</a></li>
							<li><a href='{relative_path}/admin/testing/feed'>RSS Feed</a></li>
							<li><a href='{relative_path}/admin/testing/emails'>Emails</a></li>-->
						</ul>
					</ul>
				</div><!--/.well -->
			</div><!--/span-->

			<div class="col-sm-9" id="content">

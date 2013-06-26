<!DOCTYPE html>
<html>
<head>
	<title>NodeBB Administration Panel</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link id="base-theme" href="/vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet" media="screen">
	<link href="/vendor/bootstrap/css/bootstrap-responsive.min.css" rel="stylesheet" media="screen">
	<link rel="stylesheet" href="/vendor/fontawesome/css/font-awesome.min.css">
	<script type="text/javascript" src="http://code.jquery.com/jquery.js"></script>
	<script type="text/javascript" src="/vendor/bootstrap/js/bootstrap.min.js"></script>
	<script type="text/javascript" src="http://code.jquery.com/qunit/qunit-git.js"></script>
	<link rel="stylesheet" type="text/css" href="http://code.jquery.com/qunit/qunit-git.css">
	<script type="text/javascript" src="/socket.io/socket.io.js"></script>
	<script type="text/javascript" src="/src/app.js"></script>
	<script type="text/javascript" src="/src/templates.js"></script>
	<script type="text/javascript" src="/src/ajaxify.js"></script>
	<script src="/vendor/requirejs/require.js"></script>
	<script src="/vendor/bootbox/bootbox.min.js"></script>
	<script>
		require.config({
			baseUrl: "/src/modules",
			waitSeconds: 3
		});
	</script>
	<link rel="stylesheet" type="text/css" href="http://code.jquery.com/ui/1.10.3/themes/smoothness/jquery-ui.css">
	<script type="text/javascript" src="http://code.jquery.com/ui/1.10.3/jquery-ui.js"></script>
	<link rel="stylesheet" type="text/css" href="/css/style.css" />
	<link rel="stylesheet" type="text/css" href="/css/admin.css" />
</head>

<body class="admin">
	<div class="navbar navbar-inverse navbar-fixed-top">
		<div class="navbar-inner">
			<div class="container-fluid">
				<a class="brand" href="/admin/index">NodeBB ACP</a>
				<button type="button" class="btn btn-navbar" data-toggle="collapse" data-target=".nav-collapse">
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
				</button>
				<div class="nav-collapse collapse">
					<ul class="nav">
						<li>
						  <a href="/" target="_blank"><i class="icon-book"></i> Forum</a>
						</li>
						<li>
						  <a href="/admin/index"><i class="icon-home"></i> Home</a>
						</li>
						<li>
						  <a href="/admin/settings"><i class="icon-cogs"></i> Settings</a>
						</li>
					</ul>
					<ul class="nav pull-right" id="right-menu">
						<li><a href="/users" id="user_label"></a></li>
					</ul>
				</div>
			</div>
		</div>
	</div>

	<div id="alert_window"></div>
	
	<div class="container-fluid">
		<div class="row-fluid">
			<div class="span3">
				<div class="well sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header">NodeBB</li>
						<li class='active'><a href='/admin/index'><i class='icon-home'></i> Home</a></li>
						<li class=''><a href='/admin/categories'><i class='icon-folder-close-alt'></i> Categories</a></li>
						<li class=''><a href='/admin/users/latest'><i class='icon-user'></i> Users</a></li>
						<li class=''><a href='/admin/topics'><i class='icon-book'></i> Topics</a></li>
						<li class=''><a href='/admin/themes'><i class='icon-th'></i> Themes</a></li>
						<li class=''><a href='/admin/settings'><i class='icon-cogs'></i> Settings</a></li>
						<li class=''><a href='/admin/redis'><i class='icon-hdd'></i> Redis</a></li>
						<li class=''><a href="/admin/motd"><i class="icon-comment"></i> MOTD</a></li>

						<li class="nav-header">Social Authentication</li>
						<li class=''><a href='/admin/twitter'><i class='icon-twitter-sign'></i> Twitter</a></li>
						<li class=''><a href='/admin/facebook'><i class='icon-facebook-sign'></i> Facebook</a></li>
						<li class=''><a href='/admin/gplus'><i class='icon-google-plus-sign'></i> Google+</a></li>
						<!--<li class="nav-header">Custom Modules</li>-->
						<!-- <li class=''><a href=''>Search</a></li> -->
						<li class="nav-header">Unit Tests</li>
						<ul class="nav nav-list">
							<li class=''><a href='/admin/testing/categories'>Categories</a></li>
							<li class=''><a href='/admin/testing/topics'>Topics</a></li>
							<li class=''><a href='/admin/testing/posts'>Posts</a></li>
							<li class=''><a href='/admin/testing/accounts'>Accounts</a></li>
							<li class=''><a href='/admin/testing/chat'>Chat</a></li>
							<li class=''><a href='/admin/testing/notifications'>Notifications</a></li>
							<li class=''><a href='/admin/testing/friends'>Friends</a></li>
							<li class=''><a href='/admin/testing/feed'>RSS Feed</a></li>
							<li class=''><a href='/admin/testing/emails'>Emails</a></li>
						</ul>
					</ul>
				</div><!--/.well -->
			</div><!--/span-->
			<div class="span9" id="content">
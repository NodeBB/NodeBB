<!DOCTYPE html>
<html>
<head>
	<title>NodeBB Administration Panel</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<script>
		var RELATIVE_PATH = "{relative_path}";
	</script>
	<link id="base-theme" href="{relative_path}/vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet" media="screen">
	<link href="{relative_path}/vendor/bootstrap/css/bootstrap-responsive.min.css" rel="stylesheet" media="screen">
	<link rel="stylesheet" href="{relative_path}/vendor/fontawesome/css/font-awesome.min.css">
	<script type="text/javascript" src="http://code.jquery.com/jquery.js"></script>
	<script type="text/javascript" src="{relative_path}/vendor/bootstrap/js/bootstrap.min.js"></script>
	<script type="text/javascript" src="http://code.jquery.com/qunit/qunit-git.js"></script>
	<link rel="stylesheet" type="text/css" href="http://code.jquery.com/qunit/qunit-git.css">
	<script type="text/javascript" src="{relative_path}/socket.io/socket.io.js"></script>
	<script type="text/javascript" src="{relative_path}/src/app.js"></script>
	<script type="text/javascript" src="{relative_path}/src/templates.js"></script>
	<script type="text/javascript" src="{relative_path}/src/ajaxify.js"></script>
	<script src="{relative_path}/vendor/requirejs/require.js"></script>
	<script src="{relative_path}/vendor/bootbox/bootbox.min.js"></script>
	<script>
		require.config({
			baseUrl: "{relative_path}/src/modules",
			waitSeconds: 3
		});
	</script>
	<link rel="stylesheet" type="text/css" href="http://code.jquery.com/ui/1.10.3/themes/smoothness/jquery-ui.css">
	<script type="text/javascript" src="http://code.jquery.com/ui/1.10.3/jquery-ui.js"></script>
	<script src="{relative_path}/src/utils.js"></script>

	<link rel="stylesheet" type="text/css" href="{relative_path}/css/nodebb.css" />
	<link rel="stylesheet" type="text/css" href="{relative_path}/css/admin.css" />
</head>

<body class="admin">
	<div class="navbar navbar-inverse navbar-fixed-top">
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

	<div class="container">
		<div class="row">
			<div class="col-md-3">
				<div class="well sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header">NodeBB</li>
						<li class='active'><a href='{relative_path}/admin/index'><i class='icon-home'></i> Home</a></li>
						<li class=''><a href='{relative_path}/admin/categories/active'><i class='icon-folder-close-alt'></i> Categories</a></li>
						<li class=''><a href='{relative_path}/admin/users/latest'><i class='icon-user'></i> Users</a></li>
						<li class=""><a href="{relative_path}/admin/groups"><i class="icon-group"></i> Groups</a></li>
						<li class=''><a href='{relative_path}/admin/topics'><i class='icon-book'></i> Topics</a></li>
						<li class=''><a href='{relative_path}/admin/themes'><i class='icon-th'></i> Themes</a></li>
						<li class=''><a href='{relative_path}/admin/plugins'><i class='icon-code-fork'></i> Plugins</a></li>
						<li class=''><a href='{relative_path}/admin/settings'><i class='icon-cogs'></i> Settings</a></li>
						<li class=''><a href='{relative_path}/admin/redis'><i class='icon-hdd'></i> Redis</a></li>
						<li class=''><a href="{relative_path}/admin/motd"><i class="icon-comment"></i> MOTD</a></li>

						<li class="nav-header">Social Authentication</li>
						<li class=''><a href='{relative_path}/admin/twitter'><i class='icon-twitter-sign'></i> Twitter</a></li>
						<li class=''><a href='{relative_path}/admin/facebook'><i class='icon-facebook-sign'></i> Facebook</a></li>
						<li class=''><a href='{relative_path}/admin/gplus'><i class='icon-google-plus-sign'></i> Google+</a></li>
						<!--<li class="nav-header">Custom Modules</li>-->
						<!-- <li class=''><a href=''>Search</a></li> -->
						<li class="nav-header">Unit Tests</li>
						<ul class="nav nav-list">
							<li class=''><a href='{relative_path}/admin/testing/categories'>Categories</a></li>
							<!--<li class=''><a href='{relative_path}/admin/testing/topics'>Topics</a></li>
							<li class=''><a href='{relative_path}/admin/testing/posts'>Posts</a></li>
							<li class=''><a href='{relative_path}/admin/testing/accounts'>Accounts</a></li>
							<li class=''><a href='{relative_path}/admin/testing/chat'>Chat</a></li>
							<li class=''><a href='{relative_path}/admin/testing/notifications'>Notifications</a></li>
							<li class=''><a href='{relative_path}/admin/testing/friends'>Friends</a></li>
							<li class=''><a href='{relative_path}/admin/testing/feed'>RSS Feed</a></li>
							<li class=''><a href='{relative_path}/admin/testing/emails'>Emails</a></li>-->
						</ul>
					</ul>
				</div><!--/.well -->
			</div><!--/span-->
			<div class="col-md-9" id="content">
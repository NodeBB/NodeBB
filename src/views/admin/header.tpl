<!DOCTYPE html>
<html>
<head>
	<title>NodeBB Admin Control Panel</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">

	<link rel="stylesheet" href="{relative_path}/vendor/jquery/css/smoothness/jquery-ui-1.10.4.custom.min.css">
	<link rel="stylesheet" type="text/css" href="{relative_path}/vendor/colorpicker/colorpicker.css">
	<link rel="stylesheet" type="text/css" href="{relative_path}/vendor/nanoscroller/nanoscroller.css">
	<link rel="stylesheet" type="text/css" href="{relative_path}/admin.css?{cache-buster}" />

	<script>
		var RELATIVE_PATH = "{relative_path}";
	</script>

	<!--[if lt IE 9]>
  		<script src="//cdnjs.cloudflare.com/ajax/libs/es5-shim/2.3.0/es5-shim.min.js"></script>
  		<script src="//cdnjs.cloudflare.com/ajax/libs/html5shiv/3.7/html5shiv.js"></script>
  		<script src="//cdnjs.cloudflare.com/ajax/libs/respond.js/1.4.2/respond.js"></script>
	    <script>__lt_ie_9__ = 1;</script>
	<![endif]-->

	<script type="text/javascript" src="{relative_path}/vendor/chart.js/chart.min.js"></script>
	<script type="text/javascript" src="{relative_path}/vendor/hammer/hammer.min.js"></script>
	<script type="text/javascript" src="{relative_path}/socket.io/socket.io.js"></script>
	<script type="text/javascript" src="{relative_path}/nodebb.min.js"></script>
	<script type="text/javascript" src="{relative_path}/vendor/colorpicker/colorpicker.js"></script>
	<script type="text/javascript" src="{relative_path}/src/admin.js?{cache-buster}"></script>
	<script type="text/javascript" src="{relative_path}/vendor/ace/ace.js"></script>
	<script type="text/javascript" src="{relative_path}/vendor/nanoscroller/nanoscroller.min.js"></script>

	<script>
		require.config({
			baseUrl: "{relative_path}/src/modules",
			waitSeconds: 3,
			urlArgs: "{cache-buster}",
			paths: {
				'forum': '../forum',
				'vendor': '../../vendor',
				'buzz': '../../vendor/buzz/buzz.min'
			}
		});
	</script>

	<!-- BEGIN scripts -->
	<script type="text/javascript" src="{scripts.src}"></script>
	<!-- END scripts -->
</head>

<body class="admin">
	<div class="navbar navbar-inverse navbar-fixed-top header">
		<div class="container">
			<div class="navbar-header">
				<a class="navbar-brand nodebb-logo" href="{relative_path}/admin/general/dashboard"><img src="{relative_path}/images/logo.png" alt="NodeBB ACP" /> Admin Control Panel <span id="breadcrumbs" class="hidden-xs"></span></a>
			</div>
			<ul class="nav navbar-nav">
				<li>
					<a href="#" id="reconnect"></a>
				</li>
			</ul>

			<ul id="logged-in-menu" class="nav navbar-nav navbar-right">
				<form class="navbar-form navbar-left hidden-xs" role="search">
					<div class="form-group" id="acp-search" >
						<div class="dropdown" >
							<input type="text" data-toggle="dropdown" class="form-control" placeholder="Search ACP...">
							<ul class="dropdown-menu" role="menu"></ul>
						</div>
					</div>
				</form>

				<li id="user_label" class="dropdown">
					<a class="dropdown-toggle" data-toggle="dropdown" href="#" id="user_dropdown">
						<img src="{userpicture}"/>
					</a>
					<ul id="user-control-list" class="dropdown-menu" aria-labelledby="user_dropdown">
						<li>
							<a id="user-profile-link" href="{relative_path}/user/{userslug}" target="_top"><span>Profile</span></a>
						</li>
						<li id="logout-link">
							<a href="#">Log out</a>
						</li>
					</ul>
				</li>
			</ul>
		</div>
	</div>

	<div class="wrapper">
		<div id="main-menu" class="nano">
			<div class="nano-content">
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-dashboard"></i> General</li>
						<li class="active"><a href="{relative_path}/admin/general/dashboard">Dashboard</a></li>
						<li><a href="{relative_path}/admin/general/languages">Languages</a></li>
						<li><a href="{relative_path}/admin/general/sounds">Sounds</a></li>
					</ul>
				</div>
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-comments-o"></i> Manage</li>
						<li><a href="{relative_path}/admin/manage/categories/active">Categories</a></li>
						<li><a href="{relative_path}/admin/manage/tags">Tags</a></li>
						<li><a href="{relative_path}/admin/manage/users/latest">Users</a></li>
						<li><a href="{relative_path}/admin/manage/groups">Groups</a></li>
					</ul>
				</div>
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-cogs"></i> Settings</li>
						<li><a href="{relative_path}/admin/settings/general">General</a></li>
						<li><a href="{relative_path}/admin/settings/reputation">Reputation</a></li>
						<li><a href="{relative_path}/admin/settings/email">Email</a></li>
						<li><a href="{relative_path}/admin/settings/user">User</a></li>
						<li><a href="{relative_path}/admin/settings/post">Post</a></li>
						<li><a href="{relative_path}/admin/settings/pagination">Pagination</a></li>
						<li><a href="{relative_path}/admin/settings/tags">Tags</a></li>
						<li><a href="{relative_path}/admin/settings/notifications">Notifications</a></li>
						<li><a href="{relative_path}/admin/settings/web-crawler">Web Crawler</a></li>
						<li><a href="{relative_path}/admin/settings/sockets">Sockets</a></li>
						<li><a href="{relative_path}/admin/settings/advanced">Advanced</a></li>
					</ul>
				</div>
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-paint-brush"></i> Appearance</li>
						<li><a href="{relative_path}/admin/appearance/themes">Themes</a></li>
						<li><a href="{relative_path}/admin/appearance/skins">Skins</a></li>
						<li><a href="{relative_path}/admin/appearance/customise">Custom HTML & CSS</a></li>
					</ul>
				</div>
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-wrench"></i> Extend</li>
						<li><a href="{relative_path}/admin/extend/plugins">Plugins</a></li>
						<li><a href="{relative_path}/admin/extend/widgets">Widgets</a></li>
					</ul>
				</div>
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-hdd-o"></i> Advanced</li>
						<li><a href="{relative_path}/admin/advanced/database">Database</a></li>
						<li><a href="{relative_path}/admin/advanced/events">Events</a></li>
					</ul>
				</div>
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-facebook-square"></i> Social Authentication</li>
						<!-- IF !authentication.length -->
						<li><a href="{relative_path}/admin/extend/plugins">Install SSO Plugins</a></li>
						<!-- ENDIF !authentication.length -->
						<!-- BEGIN authentication -->
						<li>
							<a href="{relative_path}/admin{authentication.route}">{authentication.name}</a>
						</li>
						<!-- END authentication -->
					</ul>
				</div>
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-th"></i> Installed Plugins</li>
						<!-- BEGIN plugins -->
						<li>
							<a href="{relative_path}/admin{plugins.route}">{plugins.name}</a>
						</li>
						<!-- END plugins -->
					</ul>
				</div>
				<!-- IF env -->
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-th"></i> Development</li>
						<li><a href="{relative_path}/admin/development/logger">Logger</a></li>
					</ul>
				</div>
				<!-- ENDIF env -->
			</div>
		</div>
		<div class="col-sm-12" id="content">
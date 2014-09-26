<!DOCTYPE html>
<html>
<head>
	<title>NodeBB Administration Panel</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">

	<link rel="stylesheet" href="{relative_path}/vendor/jquery/css/smoothness/jquery-ui-1.10.4.custom.min.css">
	<link rel="stylesheet" type="text/css" href="{relative_path}/vendor/colorpicker/colorpicker.css">
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

	<script type="text/javascript" src="{relative_path}/socket.io/socket.io.js"></script>
	<script type="text/javascript" src="{relative_path}/nodebb.min.js"></script>
	<script type="text/javascript" src="{relative_path}/vendor/colorpicker/colorpicker.js"></script>
	<script type="text/javascript" src="{relative_path}/src/admin.js?{cache-buster}"></script>
	<script type="text/javascript" src="{relative_path}/vendor/ace/ace.js"></script>

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
				<button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
				</button>
				<a class="navbar-brand" href="{relative_path}/admin/index">NodeBB ACP</a>
			</div>
			<div class="collapse navbar-collapse">
				<ul class="nav navbar-nav">
					<li>
						<a href="{relative_path}/admin/index"><i class="fa fa-home" title="Home"></i><span class="visible-xs-inline"> Home</span></a>
					</li>
					<li>
						<a href="{relative_path}/admin/settings/general"><i class="fa fa-cogs" title="Settings"></i><span class="visible-xs-inline"> Settings</span></a>
					</li>
					<li>
						<a href="{relative_path}/" target="_top"><i class="fa fa-book" title="Forum"></i><span class="visible-xs-inline"> Forum</span></a>
					</li>
					<li>
						<a href="#" id="reconnect"></a>
					</li>
				</ul>

				<ul id="logged-in-menu" class="nav navbar-nav navbar-right">
					<form class="navbar-form navbar-left" role="search">
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
	</div>

	<div class="wrapper">
		<div id="main-menu">
			<div class="sidebar-nav">
				<ul class="nav nav-list">
					<li class="nav-header">General</li>
					<li class="active"><a href="{relative_path}/admin/index"><i class="fa fa-fw fa-home"></i> Home</a></li>
					<li><a href="{relative_path}/admin/languages"><i class="fa fa-fw fa-language"></i> Languages</a></li>
					<li><a href="{relative_path}/admin/settings/general"><i class="fa fa-fw fa-cogs"></i> Settings</a></li>
					<li><a href="{relative_path}/admin/sounds"><i class="fa fa-fw fa-volume-up"></i> Sounds</a></li>
				</ul>
			</div>
			<div class="sidebar-nav">
				<ul class="nav nav-list">
					<li class="nav-header">Manage</li>
					<li><a href="{relative_path}/admin/categories/active"><i class="fa fa-fw fa-folder"></i> Categories</a></li>
					<li><a href="{relative_path}/admin/tags"><i class="fa fa-fw fa-tags"></i> Tags</a></li>
					<li><a href="{relative_path}/admin/users/latest"><i class="fa fa-fw fa-user"></i> Users</a></li>
					<li><a href="{relative_path}/admin/groups"><i class="fa fa-fw fa-group"></i> Groups</a></li>
				</ul>
			</div>
			<div class="sidebar-nav">
				<ul class="nav nav-list">
					<li class="nav-header">Appearance</li>
					<li><a href="{relative_path}/admin/appearance/themes"><i class="fa fa-fw fa-th"></i> Themes</a></li>
					<li><a href="{relative_path}/admin/appearance/skins"><i class="fa fa-fw fa-th"></i> Skins</a></li>
					<li><a href="{relative_path}/admin/appearance/customise"><i class="fa fa-fw fa-th"></i> Custom HTML & CSS</a></li>
				</ul>
			</div>
			<div class="sidebar-nav">
				<ul class="nav nav-list">
					<li class="nav-header">Extend</li>
					<li><a href="{relative_path}/admin/plugins"><i class="fa fa-fw fa-code-fork"></i> Plugins</a></li>
					<li><a href="{relative_path}/admin/appearance/widgets"><i class="fa fa-fw fa-th"></i> Widgets</a></li>
				</ul>
			</div>
			<div class="sidebar-nav">
				<ul class="nav nav-list">
					<li class="nav-header">Advanced</li>
					<li><a href="{relative_path}/admin/database"><i class="fa fa-fw fa-hdd-o"></i> Database</a></li>
					<li><a href="{relative_path}/admin/events"><i class="fa fa-fw fa-calendar-o"></i> Events</a></li>
				</ul>
			</div>
			<div class="sidebar-nav">
				<ul class="nav nav-list">
					<li class="nav-header">Social Authentication</li>
					<!-- IF !authentication.length -->
					<li><a href="{relative_path}/admin/plugins"><i class="fa fa-fw fa-code-fork"></i> Install SSO Plugins</a></li>
					<!-- ENDIF !authentication.length -->
					<!-- BEGIN authentication -->
					<li>
						<a href="{relative_path}/admin{authentication.route}"><i class="fa fa-fw {authentication.icon}"></i> {authentication.name}</a>
					</li>
					<!-- END authentication -->
				</ul>
			</div>
			<div class="sidebar-nav">
				<ul class="nav nav-list">
					<li class="nav-header">Plugins</li>
					<!-- BEGIN plugins -->
					<li>
						<a href="{relative_path}/admin{plugins.route}"><i class="fa fa-fw {plugins.icon}"></i> {plugins.name}</a>
					</li>
					<!-- END plugins -->
				</ul>
			</div>
			<!-- IF env -->
			<div class="sidebar-nav">
				<ul class="nav nav-list">
					<li class="nav-header">Development</li>
					<li><a href="{relative_path}/admin/logger"><i class="fa fa-fw fa-th"></i> Logger</a></li>
				</ul>
			</div>
			<!-- ENDIF env -->
		</div>
		<div class="col-sm-12" id="content">
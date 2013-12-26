<!DOCTYPE html>
<html>
<head>
	<title>{browserTitle}</title>
	{meta_tags}
	<link rel="icon" type="image/x-icon" href="{brand:favicon}" />
	<link href="{cssSrc}" rel="stylesheet" media="screen">
	<link rel="stylesheet" href="{relative_path}/vendor/fontawesome/css/font-awesome.min.css">
	<link rel="stylesheet" type="text/css" href="{relative_path}/css/theme.css{cache-buster}" />
	{link_tags}
	<!-- BEGIN pluginCSS -->
	<link rel="stylesheet" href="{pluginCSS.path}">
	<!-- END pluginCSS -->
	<script>
		var RELATIVE_PATH = "{relative_path}";
	</script>
	<script src="{relative_path}/socket.io/socket.io.js"></script>
	<!-- BEGIN clientScripts -->
	<script src="{relative_path}/{clientScripts.script}"></script>
	<!-- END clientScripts -->
	<script>
		require.config({
			baseUrl: "{relative_path}/src/modules",
			waitSeconds: 3,
			paths: {
				"forum": '../forum'
			}
		});
	</script>
</head>

<body>
	<div class="navbar navbar-inverse navbar-fixed-top header" role="navigation" id="header-menu">
		<div class="container">
			<div class="navbar-header">
				<button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
				</button>
				<div>
					<a href="/">
						<img class="{brand:logo:display} forum-logo" src="{brand:logo}" />
					</a>
					<a href="/">
						<h1 class="navbar-brand forum-title">{title}</h1>
					</a>
				</div>
			</div>

			<div class="navbar-collapse collapse navbar-ex1-collapse">
				<ul id="main-nav" class="nav navbar-nav">
					<li>
						<a href="/recent"><i class="fa fa-clock-o" title="[[global:header.recent]]"></i></a>
					</li>
					<li class="nodebb-loggedin">
						<a href="/unread"><i class="fa fa-envelope" title="[[global:header.unread]]"> <span id="numUnreadBadge" class="">0</span></i></a>
					</li>
					<li>
						<a href="/users"><i class="fa fa-users" title="[[global:header.users]]"></i></a>
					</li>
					<li class="{adminDisplay}">
						<a href="/admin"><i class="fa fa-cogs" title="[[global:header.admin]]"></i></a>
					</li>
					<li class="visible-xs">
						<a href="/search">[[global:header.search]]</a>
					</li>
					<!-- BEGIN navigation -->
					<li class="{navigation.class}">
						<a href="{navigation.route}" title="{navigation.title}">
						    <!-- IF navigation.iconClass -->
							<i class="fa {navigation.iconClass}"></i>
							<!-- ENDIF navigation.iconClass -->

							<!-- IF navigation.text -->
							<span class="{navigation.textClass}">{navigation.text}</span>
							<!-- ENDIF navigation.text -->
						</a>
					</li>
					<!-- END navigation -->
				</ul>

				<ul id="logged-in-menu" class="nav navbar-nav navbar-right hide">
					<li>
						<a href="#" id="reconnect" class="hide" title="Connection to {title} has been lost, attempting to reconnect..."><i class="fa fa-check"></i></a>
					</li>

					<li class="notifications dropdown text-center hidden-xs">
						<a class="dropdown-toggle" data-toggle="dropdown" href="#" id="notif_dropdown"></a>
						<ul id="notif-list" class="dropdown-menu" aria-labelledby="notif_dropdown">
							<li>
								<a href="#"><i class="fa fa-refresh fa-spin"></i> [[global:notifications.loading]]</a>
							</li>
						</ul>
					</li>

					<li class="chats dropdown text-center hidden-xs">
						<a class="dropdown-toggle" data-toggle="dropdown" href="#" id="chat_dropdown"><i class="fa fa-comment"></i></a>
						<ul id="chat-list" class="dropdown-menu" aria-labelledby="chat_dropdown">
							<li>
								<a href="#"><i class="fa fa-refresh fa-spin"></i> [[global:chats.loading]]</a>
							</li>
						</ul>
					</li>

					<li id="user_label" class="dropdown">
						<a class="dropdown-toggle" data-toggle="dropdown" href="#" id="user_dropdown">
							<img src=""/>
						</a>
						<ul id="user-control-list" class="dropdown-menu" aria-labelledby="user_dropdown">
							<li>
								<a id="user-profile-link" href=""><span>[[global:header.profile]]</span></a>
							</li>
							<li id="logout-link">
								<a href="#">[[global:logout]]</a>
							</li>
						</ul>
					</li>

				</ul>

				<ul id="logged-out-menu" class="nav navbar-nav navbar-right">
					<!-- IF allowRegistration -->
					<li class="visible-lg visible-md visible-sm">
						<a href="/register">[[global:register]]</a>
					</li>
					<!-- ENDIF allowRegistration -->
					<li class="visible-lg visible-md visible-sm">
						<a href="/login">[[global:login]]</a>
					</li>
					<li class="visible-xs">
						<a class="dropdown-toggle" data-toggle="dropdown" href="#" id="loggedout_dropdown"><i class="fa fa-sign-in"></i></a>
						<ul class="dropdown-menu" aria-labelledby="loggedout_dropdown">
							<li>
								<a href="/register">[[global:register]]</a>
							</li>
							<li>
								<a href="/login">[[global:login]]</a>
							</li>
						</ul>
					</li>
				</ul>

				<ul id="logged-conditional-menu" class="nav navbar-nav navbar-right">
					<li>
						<form id="search-form" class="navbar-form navbar-right hidden-xs" role="search" method="GET" action="">
							<div class="hide" id="search-fields">
								<div class="form-group">
									<input type="text" class="form-control" placeholder="Search" name="query" value="">
								</div>
								<button type="submit" class="btn btn-default hide">[[global:search]]</button>
							</div>
							<button id="search-button" type="button" class="btn btn-link hide"><i class="fa fa-search"></i></button>
						</form>
					</li>
				</ul>

				<ul class="nav navbar-nav navbar-right pagination-block">
					<li class="active">
						<a href="#">
							<i class="fa fa-chevron-up pointer"></i>
							<span id="pagination"></span>
							<i class="fa fa-chevron-down pointer"></i>
							<div class="progress-container">
								<div class="progress-bar"></div>
							</div>
						</a>
					</li>
				</ul>
			</div>
		</div>
	</div>

	<input id="csrf_token" type="hidden" template-variable="csrf" value="{csrf}" />

	<div class="container" id="content">

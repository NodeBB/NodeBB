<!DOCTYPE html>
<html>
<head>
	<title>NodeBB Admin Control Panel</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">

	<link rel="stylesheet" href="{relative_path}/vendor/jquery/css/smoothness/jquery-ui-1.10.4.custom.min.css?{cache-buster}">
	<link rel="stylesheet" type="text/css" href="{relative_path}/admin.css?{cache-buster}" />
	<link rel="stylesheet" type="text/css" href="{relative_path}/vendor/mdl/mdl.min.css?{cache-buster}" />
	<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">

	<script>
		var RELATIVE_PATH = "{relative_path}";
		var config = JSON.parse('{{configJSON}}');
		var app = {
			template: "{template.name}",
			user: JSON.parse('{{userJSON}}')
		};
	</script>

	<!--[if lt IE 9]>
		<script src="//cdnjs.cloudflare.com/ajax/libs/es5-shim/2.3.0/es5-shim.min.js"></script>
		<script src="//cdnjs.cloudflare.com/ajax/libs/html5shiv/3.7/html5shiv.js"></script>
		<script src="//cdnjs.cloudflare.com/ajax/libs/respond.js/1.4.2/respond.js"></script>
		<script>__lt_ie_9__ = 1;</script>
	<![endif]-->

		<script src="https://storage.googleapis.com/code.getmdl.io/1.0.3/material.min.js"></script>
		<script type="text/javascript" src="{relative_path}/vendor/chart.js/chart.min.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/hammer/hammer.min.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/jquery/sortable/Sortable.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/nodebb.min.js?{cache-buster}"></script>
		<script>
			require.config({
				baseUrl: "{relative_path}/src/modules",
				waitSeconds: 3,
				urlArgs: "{cache-buster}",
				paths: {
					'admin': '../admin',
					'vendor': '../../vendor',
					'buzz': '../../vendor/buzz/buzz.min'
				}
			});

			app.inAdmin = true;
		</script>
		<script type="text/javascript" src="{relative_path}/vendor/colorpicker/colorpicker.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/src/admin/admin.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/ace/ace.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/jquery/event/jquery.event.drag.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/jquery/event/jquery.event.drop.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/semver/semver.browser.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/jquery/serializeObject/jquery.ba-serializeobject.min.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/jquery/deserialize/jquery.deserialize.min.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/mousetrap/mousetrap.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/jquery/js/jquery-ui-1.10.4.custom.js?{cache-buster}"></script>

		<!-- BEGIN scripts -->
		<script type="text/javascript" src="{scripts.src}"></script>
		<!-- END scripts -->
	</head>

	<body class="admin">

		<!--<nav class="navbar navbar-inverse navbar-fixed-top header">
			<div class="container">
				<div class="navbar-header">
					<button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
						<span class="icon-bar"></span>
						<span class="icon-bar"></span>
						<span class="icon-bar"></span>
					</button>
					<a class="navbar-brand nodebb-logo" href="{relative_path}/admin/general/dashboard"><img src="{relative_path}/images/logo.png" alt="NodeBB ACP" /> Admin Control Panel <span id="breadcrumbs" class="hidden-xs"></span></a>
					<ul class="nav navbar-nav pull-left">
						<li>
							<a href="#" id="reconnect"></a>
						</li>
					</ul>
				</div>
				<div class="navbar-collapse collapse">
					<ul id="logged-in-menu" class="navbar-nav nav navbar-right">
						<li class="hidden-lg hidden-md hidden-sm">
							<a href="{relative_path}/" target="_blank" title="View Forum">
								View Forum
							</a>
						</li>
						<li class="hidden-lg hidden-md hidden-sm">
							<a id="user-profile-link" href="{relative_path}/user/{user.userslug}" target="_top">
								View Profile
							</a>
						</li>
						<li role="presentation" class="hidden-lg hidden-md hidden-sm divider"></li>
						<li class="hidden-lg hidden-md hidden-sm">
							<a href="#" class="reload" title="Reload Forum">
								Reload Forum
							</a>
						</li>
						<li class="hidden-lg hidden-md hidden-sm">
							<a href="#" class="restart" title="Restart Forum">
								Restart Forum
							</a>
						</li>
						<li role="presentation" class="hidden-lg hidden-md hidden-sm divider"></li>
						<li component="logout" class="hidden-lg hidden-md hidden-sm">
							<a href="#">Log out</a>
						</li>
						<li style="float:left;">
							<form class="navbar-form hidden-xs" role="search">
								<div class="form-group" id="acp-search" >
									<div class="dropdown" >
										<input type="text" data-toggle="dropdown" class="form-control" placeholder="/">
										<ul class="dropdown-menu" role="menu"></ul>
									</div>
								</div>
							</form>
						</li>
						<li id="user_label" class="dropdown pull-right hidden-xs">
							<a class="dropdown-toggle" data-toggle="dropdown" href="#" id="user_dropdown">
								<img src="{user.picture}"/>
							</a>
							<ul id="user-control-list" class="dropdown-menu" aria-labelledby="user_dropdown">
								<li>
									<a href="{relative_path}/" target="_blank" title="View Forum">
										View Forum
									</a>
								</li>
								<li>
									<a id="user-profile-link" href="{relative_path}/user/{user.userslug}" target="_top">
										View Profile
									</a>
								</li>
								<li role="presentation" class="divider"></li>
								<li>
									<a href="#" class="reload" title="Reload Forum">
										Reload Forum
									</a>
								</li>
								<li>
									<a href="#" class="restart" title="Restart Forum">
										Restart Forum
									</a>
								</li>
								<li role="presentation" class="divider"></li>
								<li component="logout">
									<a href="#">Log out</a>
								</li>
							</ul>
						</li>
					</ul>
				</div>
			</div>
		</nav>-->

		<!-- IMPORT admin/partials/menu.tpl -->
		
		<div class="container" id="content">
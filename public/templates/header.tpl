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
	<script src="{relative_path}/socket.io/socket.io.js"></script>
	<script src="{relative_path}/src/nodebb.min.js"></script>
	<script>
		require.config({
			baseUrl: "{relative_path}/src/modules",
			waitSeconds: 3
		});
	</script>

	<link rel="stylesheet" type="text/css" href="{relative_path}/css/nodebb.css" />
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
		        <a class="navbar-brand" href="/">{title}</a>
		    </div>

			<div class="navbar-collapse collapse navbar-ex1-collapse">
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
					<li class="visible-xs">
						<a href="/search">Search</a>
					</li>
					<li>
						<a href="/"></a>
					</li>
				</ul>

				<form id="search-form" class="navbar-form navbar-right hidden-xs" role="search" method="GET" action="">
					<div class="hide" id="search-fields">
						<div class="form-group">
							<input type="text" class="form-control" placeholder="Search" name="query" value="">
						</div>
						<button type="submit" class="btn btn-default hide">Search</button>
					</div>
					<button id="search-button" type="button" class="btn btn-link"><i class="icon-search"></i></button>
				</form>

				<ul id="right-menu" class="nav navbar-nav navbar-right">
					<li class="notifications dropdown text-center hidden-xs">
						<a class="dropdown-toggle" data-toggle="dropdown" href="#" id="notif_dropdown"><i class="icon-circle-blank"></i></a>
						<ul id="notif-list" class="dropdown-menu" aria-labelledby="notif_dropdown">
							<li>
								<a href="#"><i class="icon-refresh icon-spin"></i> Loading Notifications</a>
							</li>
						</ul>
					</li>
				</ul>

				<div class="pagination-block">
					<i class="icon-upload pointer"></i>
					<span id="pagination"></span>
					<i class="icon-upload pointer icon-rotate-180"></i>
				</div>
			</div>
		</div>
	</div>

	<input id="csrf_token" type="hidden" template-variable="csrf" value="{csrf}" />

	<div class="container" id="content">
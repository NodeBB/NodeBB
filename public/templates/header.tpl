<!DOCTYPE html>
<html>
<head>
	<title>{title}</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta name="title" CONTENT="NodeBB">
	<meta name="keywords" content="" />
	<meta name="description" content="" />
	<meta http-equiv="content-type" content="text/html; charset=UTF-8" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<link href="{cssSrc}" rel="stylesheet" media="screen">
	<link href="/vendor/bootstrap/css/bootstrap-responsive.min.css" rel="stylesheet" media="screen">
	<link rel="stylesheet" href="/vendor/fontawesome/css/font-awesome.min.css">
	<script type="text/javascript" src="http://code.jquery.com/jquery.js"></script>
	<script type="text/javascript" src="/vendor/jquery/js/jquery-ui-1.10.3.custom.min.js"></script>
	<script type="text/javascript" src="/vendor/bootstrap/js/bootstrap.min.js"></script>
	<script type="text/javascript" src="/socket.io/socket.io.js"></script>
	<script type="text/javascript" src="/src/app.js"></script>
	<script src="/vendor/requirejs/require.js"></script>
	<script src="/vendor/bootbox/bootbox.min.js"></script>
	<script>
		require.config({
			baseUrl: "/src/modules",
			waitSeconds: 3
		});
	</script>
	<script type="text/javascript" src="/src/templates.js"></script>
	<script type="text/javascript" src="/src/ajaxify.js"></script>
	<script type="text/javascript" src="/src/jquery.form.js"></script>
	<script type="text/javascript" src="/src/utils.js"></script>

	<link rel="stylesheet" type="text/css" href="/css/nodebb.css" />
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
							<a href="/latest">Recent <!--<span class="badge badge-inverse">3</span>--></a>
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
    
	<div id="disconnect-modal" class="modal hide" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
	  <div class="modal-header">
	    <h3 id="myModalLabel">Socket Disconnect</h3>
	  </div>
	  <div class="modal-body">
		<span id="disconnect-text">Looks like you disconnected, try reloading the page.</span>
	  </div>
	  <div class="modal-footer">
	    <a id="reload-button" href="/" class="btn btn-primary">Reload</a>
	  </div>
	</div>

	<div id="chat-modal" class="modal hide" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
	  <div class="modal-header">
	  	<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
	    <h3 id="myModalLabel">Chat with <span id="chat-with-name"></span></h3>
	  </div>
	  <div class="modal-body">
		<textarea id="chat-content" cols="40" rows="10" readonly></textarea><br/>
		<input id="chat-message-input" type="text" name="chat-message" placeholder="type chat message here press enter to send"/><br/>
		<button type="button" id="chat-message-send-btn" href="#" class="btn btn-primary">Send</button>
	  </div>
	</div>

	<div id="alert_window"></div>

	<input id="csrf_token" type="hidden" template-variable="csrf" value="{csrf}" />

	<div class="container" id="content">


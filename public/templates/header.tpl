<!DOCTYPE html>
<html>
<head>
	<title></title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="/vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet" media="screen">
	<script type="text/javascript" src="http://code.jquery.com/jquery.js"></script>
	<script type="text/javascript" src="/vendor/bootstrap/js/bootstrap.min.js"></script>
	<script type="text/javascript" src="/socket.io/socket.io.js"></script>
	<script type="text/javascript" src="/src/app.js"></script>
	<script type="text/javascript" src="/src/templates.js"></script>
	<script type="text/javascript" src="/src/ajaxify.js"></script>
	<style type="text/css">
		body {
			padding-top: 60px;
		}

		#notification_window {
			position: absolute;
			right: 20px;
			top: 80px;
			width: 300px;
			height: 0px;

		}
		footer.footer {
			color: #555;
			text-align: center;
		}
		footer.footer a {
			color: #222;
		}
	</style>
</head>

<body>
	<div class="navbar navbar-inverse navbar-fixed-top">
      <div class="navbar-inner">
        <div class="container">
        	<div class="nav-collapse collapse">
	            <ul class="nav">
	              <li class="active"><a href="/">Home</a></li>
	              <li><a href="/register">Register</a></li>
	              <li><a href="/login">Login</a></li>
	            </ul>
	        </div>
        </div>
      </div>
    </div>
	<div id="notification_window"></div>
    <div class="container" id="content">


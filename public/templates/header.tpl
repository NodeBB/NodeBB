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
	<script type="text/javascript" src="/vendor/ckeditor/ckeditor.js"></script>
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

		.toaster-alert {

			cursor: pointer;
		}

		footer.footer {
			color: #555;
			text-align: center;
		}
		footer.footer a {
			color: #222;
		}

		#post_window {
			width: 100%;
			position: absolute;
			height: 350px;
			left: 0px;
			bottom: 0px;
			opacity: 0.8;
		}

		#post_window input {
			width: 100%;
			height: 30px;
			padding: 5px;
		}
		#post_window textarea {
			width: 100%;
			background: #222;
			height: 220px;
			resize: none;
			border-radius: 0;
			border: 1px solid #111;
			font-size: 16px;
			color: #bebebe;
		}
		#post_window textarea:focus { 
			outline: none;
			border:none !important;
			box-shadow:none !important;
		}

		#post_window .post-title-container {
			height: 50px;
		}

		#post_window .post-content-container {
			background: #000;
			width: 100%;
			height: 300px;

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
    <div id="post_window">
    	<div class="post-title-container">
	    	<div class="container">
	    		<input id="post_title" placeholder="Enter your topic title here." />
	    	</div>
	    </div>
	    <div class="post-content-container">
	    	<div class="container">

	    		<div class="btn-toolbar">
				    <div class="btn-group">
					    <a class="btn btn-link" href="#"><i class="icon-bold"></i></a>
					    <a class="btn btn-link" href="#"><i class="icon-italic"></i></a>
					    <a class="btn btn-link" href="#"><i class="icon-font"></i></a>
					    <a class="btn btn-link" href="#"><i class="icon-list"></i></a>
				    </div>
				    <div class="btn-group" style="float: right; margin-right: -12px">
					    <a class="btn" onclick="app.post_topic()"><i class="icon-ok"></i> Submit</a>
					    <a class="btn" onclick="jQuery(post_window).slideToggle(250);"><i class="icon-remove"></i> Discard</a>
					</div>
			    </div>

	    		<textarea id="post_content" placeholder="Type your message here."></textarea>

	    	</div>
	    </div>
    </div>
	<div id="notification_window"></div>
    <div class="container" id="content">
<!DOCTYPE html>
<html>
<head>
	<title></title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="/vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet" media="screen">
	<link href="/vendor/bootstrap/css/bootstrap-responsive.min.css" rel="stylesheet" media="screen">
	<script type="text/javascript" src="http://code.jquery.com/jquery.js"></script>
	<script type="text/javascript" src="/vendor/bootstrap/js/bootstrap.min.js"></script>
	<script type="text/javascript" src="/socket.io/socket.io.js"></script>
	<script type="text/javascript" src="/src/app.js"></script>
	<script type="text/javascript" src="/src/templates.js"></script>
	<script type="text/javascript" src="/src/ajaxify.js"></script>
	<style type="text/css">
	@media (min-width: 979px) {
		body {
			padding-top: 60px;
		}
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
		background: white;
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
		outline: 0;
	}
	#post_window textarea:focus { 
		outline: 0;
		border:none !important;
		box-shadow:none !important;
	}

	#post_window .post-title-container {
		opacity: 0.8;
		height: 50px;
	}

	#post_window .post-content-container {
		opacity: 0.8;
		background: #000;
		width: 100%;
		height: 300px;

	}

	.topic-container {
		list-style-type: none;
		padding: 0;
		margin: 0;
		border: 1px solid #eee;
		margin-top: 50px;
	}
	.topic-container a:nth-child(odd) li.topic-row {
		background-color:#fdfdfd;
	}
	.topic-container a:nth-child(even) li.topic-row {
		background-color:#fff;
	}
	.topic-container li.topic-row {
		cursor: pointer;
		border-bottom: 1px solid #eee;
		padding: 10px;
	}
	.topic-container li:last-child {
		border-bottom: 0;
	}
	.topic-container li.topic-row:hover {
		background-color: #eee;
	}



	.post-container {
		list-style-type: none;
		padding: 0;
		margin: 0;
		border: 1px solid #eee;
		
	}
	.post-container li.post-row:nth-child(odd) {
		background-color:#fdfdfd;
	}
	.post-container li.post-row:nth-child(even) {
		background-color:#fff;
	}
	.post-container li.post-row {
		cursor: pointer;
		border-bottom: 1px solid #eee;
		padding: 10px;
	}
	.post-container li:last-child {
		border-bottom: 0;
	}
	.post-container li.post-row:hover {
		background-color: #eee;
	}



	#user_label img {
		border: 1px solid #999;
		margin-right: 8px;
	}

	#user_label span {
		font-size: 12px;
		font-weight: bold;
	}
	#reply_title {
		font-size: 17px;
		padding-top: 14px;
		font-weight: 600;
	}
	</style>
</head>

<body>
	<div class="navbar navbar-inverse navbar-fixed-top">
		<div class="navbar-inner">
			<div class="container">
				<a class="brand" href="/">NodeBB</a>
				<button type="button" class="btn btn-navbar" data-toggle="collapse" data-target=".nav-collapse">
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
				</button>
				<div class="nav-collapse collapse">
					<ul class="nav">
						<li class="active"><a href="/">Forum</a></li>
						<!-- <li><a href="/register">Register</a></li>
						<li><a href="/login">Login</a></li> -->
					</ul>
					<ul class="nav pull-right" id="right-menu">
						<li><p class="navbar-text" id="user_label"></p></li>
						<!-- <li><a href="/logout">Log out</a></li> -->
					</ul>
				</div>
			</div>
		</div>
	</div>
	<div id="post_window">
		<div class="post-title-container">
			<div class="container">
				<input id="post_title" placeholder="Enter your topic title here." />
				<span id="reply_title"></span>
			</div>
		</div>
		<div class="post-content-container">
			<div class="container">

				<div class="btn-toolbar">
					<div class="btn-group">
						<a class="btn btn-link" href="#" tabindex="-1"><i class="icon-bold"></i></a>
						<a class="btn btn-link" href="#" tabindex="-1"><i class="icon-italic"></i></a>
						<a class="btn btn-link" href="#" tabindex="-1"><i class="icon-font"></i></a>
						<a class="btn btn-link" href="#" tabindex="-1"><i class="icon-list"></i></a>
					</div>
					<div class="btn-group" style="float: right; margin-right: -12px">
						<a id="submit_post_btn" class="btn" onclick="app.post_topic()"><i class="icon-ok"></i> Submit</a>
						<a class="btn" onclick="jQuery(post_window).slideToggle(250);"><i class="icon-remove"></i> Discard</a>
					</div>
				</div>

				<textarea id="post_content" placeholder="Type your message here."></textarea>

			</div>
		</div>
	</div>
	<div id="notification_window"></div>

	<div class="container" id="content">
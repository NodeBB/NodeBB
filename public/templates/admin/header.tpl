<!DOCTYPE html>
<html>
<head>
	<title></title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="/vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet" media="screen">
	<link href="/vendor/bootstrap/css/bootstrap-responsive.min.css" rel="stylesheet" media="screen">
	<link rel="stylesheet" href="/vendor/fontawesome/css/font-awesome.min.css">
	<script type="text/javascript" src="http://code.jquery.com/jquery.js"></script>
	<script type="text/javascript" src="/vendor/bootstrap/js/bootstrap.min.js"></script>
	<script type="text/javascript" src="/socket.io/socket.io.js"></script>
	<script type="text/javascript" src="/src/app.js"></script>
	<script type="text/javascript" src="/src/templates.js"></script>
	<script type="text/javascript" src="/src/ajaxify.js"></script>
	<link rel="stylesheet" type="text/css" href="http://code.jquery.com/ui/1.10.3/themes/smoothness/jquery-ui.css">
	<script type="text/javascript" src="http://code.jquery.com/ui/1.10.3/jquery-ui.js"></script>
	<link rel="stylesheet" type="text/css" href="/css/style.css" />
	<style type="text/css">
	.entry-row {
		border-radius: 10px;
		margin-bottom: 10px;
		padding: 10px;
		cursor: move;
		width: 555px;
	}
	.admin-categories form {
		margin: 0 0 0px;
	}

	.admin-categories input {
		height: 20px;
		padding: 5px;
		margin-left: 10px;
		width: 150px;
		border: 0;
		border-radius: 5px;
		margin-top: -8px;	
	}
	.admin-categories select {
		border: 0;
		margin-left: 10px;
		padding: 5px;
		margin-top: -8px;
	}
	.admin-categories button {
		margin-top: -7px;
	}
	.admin-categories .icon{
		width: 30px;
		height: 30px;
		text-align: center;
		line-height: 35px;
		display: inline-block;
	}
	</style>
</head>

<body>
	<div class="navbar navbar-inverse navbar-fixed-top">
		<div class="navbar-inner">
			<div class="container-fluid">
				<a class="brand" href="/admin/index">NodeBB ACP</a>
				<button type="button" class="btn btn-navbar" data-toggle="collapse" data-target=".nav-collapse">
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
					<span class="icon-bar"></span>
				</button>
				<div class="nav-collapse collapse">
					<ul class="nav">
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
	</div>
	
	<div class="container-fluid">
		<div class="row-fluid">
			<div class="span3">
				<div class="well sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header">NodeBB</li>
						<li class='active'><a href='/admin/index'><i class='icon-home'></i> Home</a></li>
						<li class=''><a href='/admin/categories'><i class='icon-folder-close-alt'></i> Categories</a></li>
						<li class=''><a href='/admin/users'><i class='icon-user'></i> Users</a></li>
						<li class=''><a href='/admin/topics'><i class='icon-book'></i> Topics</a></li>
						<li class=''><a href='/admin/themes'><i class='icon-th'></i> Themes</a></li>
						<li class=''><a href='/admin/settings'><i class='icon-cogs'></i> Settings</a></li>
						<li class="nav-header">Social Authentication</li>
						<li class=''><a href='/admin/twitter'><i class='icon-twitter'></i>Twitter</a></li>
						<li class=''><a href='/admin/facebook'><i class='icon-facebook'></i>Facebook</a></li>
						<li class=''><a href='/admin/gplus'><i class='icon-google-plus'></i>Google+</a></li>
						<li class="nav-header">Custom Modules</li>
						<li class=''><a href=''>Search</a></li>
					</ul>
				</div><!--/.well -->
			</div><!--/span-->
			<div class="span9" id="content">
<!DOCTYPE html>
<html>
<head>
	<title>{title}</title>
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
			user: JSON.parse('{{userJSON}}'),
			config: JSON.parse(decodeURIComponent("{{adminConfigJSON}}")),
			flags: {}
		};
	</script>

	<!--[if lt IE 9]>
		<script src="//cdnjs.cloudflare.com/ajax/libs/es5-shim/2.3.0/es5-shim.min.js"></script>
		<script src="//cdnjs.cloudflare.com/ajax/libs/html5shiv/3.7/html5shiv.js"></script>
		<script src="//cdnjs.cloudflare.com/ajax/libs/respond.js/1.4.2/respond.js"></script>
		<script>__lt_ie_9__ = 1;</script>
	<![endif]-->

		<script src="https://storage.googleapis.com/code.getmdl.io/1.0.3/material.min.js"></script>
		<script type="text/javascript" src="{relative_path}/vendor/jquery/sortable/Sortable.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/acp.min.js?{cache-buster}"></script>
		<script>
			require.config({
				baseUrl: "{relative_path}/src/modules",
				waitSeconds: 3,
				urlArgs: "{cache-buster}",
				paths: {
					'forum': '../client',
					'admin': '../admin',
					'vendor': '../../vendor'
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
		<script type="text/javascript" src="{relative_path}/vendor/jquery/js/jquery-ui-1.10.4.custom.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/snackbar/snackbar.min.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/slideout/slideout.min.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/nprogress.min.js?{cache-buster}"></script>

		<!-- BEGIN scripts -->
		<script type="text/javascript" src="{scripts.src}"></script>
		<!-- END scripts -->
	</head>

	<body class="admin {bodyClass}">
		<!-- IMPORT admin/partials/menu.tpl -->
		<div class="container" id="content">
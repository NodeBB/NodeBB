<!DOCTYPE html>
<html>
	<head>
		<title>{title}</title>
		<meta name="viewport" content="width=device-width, initial-scale=1.0">

		<link rel="stylesheet" type="text/css" href="{relative_path}/assets/admin.css?{cache-buster}" />
		<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">

		<script>
			var RELATIVE_PATH = "{relative_path}";
			var config = JSON.parse('{{configJSON}}');
			var app = {
				template: "{template.name}",
				user: JSON.parse('{{userJSON}}'),
				config: JSON.parse(decodeURIComponent("{{adminConfigJSON}}")),
				flags: {},
				inAdmin: true
			};
		</script>

		<script src="https://storage.googleapis.com/code.getmdl.io/1.3.0/material.min.js"></script>
		<script type="text/javascript" src="{relative_path}/assets/vendor/jquery/sortable/Sortable.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/assets/acp.min.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/assets/vendor/colorpicker/colorpicker.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/assets/src/admin/admin.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/assets/vendor/ace/ace.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/assets/vendor/semver/semver.browser.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/assets/vendor/jquery/serializeObject/jquery.ba-serializeobject.min.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/assets/vendor/jquery/deserialize/jquery.deserialize.min.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/assets/vendor/snackbar/snackbar.min.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/assets/vendor/slideout/slideout.min.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/assets/vendor/nprogress.min.js?{cache-buster}"></script>

		<!-- BEGIN scripts -->
		<script type="text/javascript" src="{scripts.src}"></script>
		<!-- END scripts -->
	</head>

	<body class="admin {bodyClass}">

    <!-- IMPORT admin/partials/menu.tpl -->
		<!-- IMPORT admin/partials/menu-moderator.tpl -->
		<script type="text/javascript">
			function getParameterByName(name, url) {
					if (!url) {
						url = window.location.href;
					}
					name = name.replace(/[\[\]]/g, "\\$&");
					var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
							results = regex.exec(url);
					if (!results) return null;
					if (!results[2]) return '';
					return decodeURIComponent(results[2].replace(/\+/g, " "));
			}
				var foo = getParameterByName('foo');

			 if(foo == "x-dag--dag-x"){
				  $(".admin-menu").css("display", 'inherit');
					$(".moderator-menu").remove();
				}
				else{
					$(".moderator-menu").css("display", 'inherit');
					$(".admin-menu").remove();
				}
			</script>
		<div class="container" id="content">

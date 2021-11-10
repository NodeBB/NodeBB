<!DOCTYPE html>
<html>
	<head>
		<title>{title}</title>

		{{{each metaTags}}}{function.buildMetaTag}{{{end}}}
		{{{each linkTags}}}{function.buildLinkTag}{{{end}}}
		<link rel="stylesheet" type="text/css" href="{relative_path}/assets/admin.css?{cache-buster}" />
		<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">

		<script>
			var config = JSON.parse('{{configJSON}}');
			var app = {
				user: JSON.parse('{{userJSON}}'),
				config: JSON.parse(decodeURIComponent("{{adminConfigJSON}}")),
				flags: {},
				inAdmin: true
			};
		</script>

		<script type="text/javascript" src="{relative_path}/assets/acp.min.js?{cache-buster}"></script>

		<!-- BEGIN scripts -->
		<script type="text/javascript" src="{scripts.src}"></script>
		<!-- END scripts -->
	</head>

	<body class="admin {bodyClass}">
		<!-- IMPORT admin/partials/menu.tpl -->
		<div class="container" id="content">
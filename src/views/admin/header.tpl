<!DOCTYPE html>
<html>
	<head>
		<title>{title}</title>

		{{{each metaTags}}}{function.buildMetaTag}{{{end}}}
		{{{each linkTags}}}{function.buildLinkTag}{{{end}}}
		<link rel="stylesheet" type="text/css" href="{relative_path}/assets/admin.css?{cache-buster}" />

		<script>
			var config = JSON.parse('{{configJSON}}');
			var app = {
				user: JSON.parse('{{userJSON}}'),
				config: JSON.parse(decodeURIComponent("{{adminConfigJSON}}")),
				flags: {},
				inAdmin: true
			};
		</script>

		<script type="text/javascript" src="{relative_path}/assets/admin.min.js?{cache-buster}"></script>

		{{{ each scripts }}}
		<script type="text/javascript" src="{./src}"></script>
		{{{ end }}}
	</head>

	<body class="admin {bodyClass}">
		<div class="d-none">
			<!-- TODO: old menu remove -->
			<!-- IMPORT admin/partials/menu.tpl -->
		</div>
		<div class="d-flex">
			<!-- IMPORT admin/partials/left-sidebar.tpl -->
			<div class="container flex-1" id="content">


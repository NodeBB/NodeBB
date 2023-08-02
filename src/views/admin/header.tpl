<!DOCTYPE html>
<html data-bs-theme="light" lang="{function.localeToHTML, acpLang, defaultLang}" {{{if languageDirection}}}data-dir="{languageDirection}" style="direction: {languageDirection};"{{{end}}}>
	<head>
		<title>{title}</title>

		{{{each metaTags}}}{function.buildMetaTag}{{{end}}}
		{{{each linkTags}}}{function.buildLinkTag}{{{end}}}
		<link rel="stylesheet" type="text/css" href="{relative_path}/assets/admin{{{ if (languageDirection=="rtl") }}}-rtl{{{ end }}}.css?{cache-buster}" />

		<script>
			var config = JSON.parse('{{configJSON}}');
			var app = {
				user: JSON.parse('{{userJSON}}'),
				config: JSON.parse(decodeURIComponent("{{adminConfigJSON}}")),
				flags: {},
				inAdmin: true
			};
			const theme = localStorage.getItem('data-bs-theme');
			if (theme && theme === 'dark') {
				document.documentElement.setAttribute('data-bs-theme', 'dark');
			}
		</script>

		<script type="text/javascript" src="{relative_path}/assets/admin.min.js?{cache-buster}"></script>

		{{{ each scripts }}}
		<script type="text/javascript" src="{./src}"></script>
		{{{ end }}}
	</head>

	<body class="admin {bodyClass}">
		<!-- IMPORT admin/partials/offcanvas.tpl -->
		<div class="d-flex">
			<!-- IMPORT admin/partials/sidebar-left.tpl -->
			<div class="container flex-1 mt-4 mb-5" id="content">


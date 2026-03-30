<div class="tags d-flex flex-column gap-2 px-lg-4">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/appearance/themes:themes]]</h4>
		</div>
		<div class="d-flex align-items-center gap-1">
			<button id="revert_theme" class="btn btn-primary btn-sm text-nowrap">[[admin/appearance/themes:revert-theme]]</button>
		</div>
	</div>

	<div id="themes" class="themes px-2">
		<div class="directory row text-center" id="installed_themes">
			{{{ if themes.length }}}
			<!-- IMPORT admin/partials/theme_list.tpl -->
			{{{ else }}}
			<div class="alert alert-info no-themes">[[admin/appearance/themes:no-themes]]</div>
			{{{ end}}}
		</div>
	</div>
</div>

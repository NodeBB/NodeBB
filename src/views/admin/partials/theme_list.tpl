{{{ each themes }}}
<div class="col-lg-4 col-md-6 col-12 mb-4" data-type="{./type}" data-theme-name="{./name}" data-theme="{./id}"{{{ if ./css }}} data-css="{./css}" {{{ end }}}>
	<div class="card h-100">
		<img src="{./screenshot_url}" class="card-img-top">
		<div class="card-body text-center">
			<h5 class="card-title">{./name}</h5>
			<p class="card-text">
				{./description}
			</p>

			{{{ if ./url }}}
			<p class="mb-0">
				<a href="{./url}" target="_blank">{{tx("admin/appearance/themes:homepage")}}</a>
			</p>
			{{{ end }}}
		</div>
		<div class="card-footer text-center">
			<a class="btn btn-primary" data-action="use">
				{{{ if ./skin }}}{{tx("admin/appearance/skins:select-skin")}}{{{ else }}}{{tx("admin/appearance/themes:select-theme")}}{{{ end }}}
			</a>
		</div>
	</div>
</div>
{{{ end }}}

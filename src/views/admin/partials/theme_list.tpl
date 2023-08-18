{{{ each themes }}}
<div class="col-lg-4 col-md-6 col-12 mb-4" data-type="{./type}" data-theme-name="{./name}" data-theme="{./id}"{{{ if ./css }}} data-css="{./css}" {{{ end }}}>
	<div class="card h-100">
		<img src="{./screenshot_url}" class="card-img-top">
		<div class="card-body">
			<h5 class="card-title">{./name}</h5>
			<p class="card-text">
				{./description}
			</p>

			{{{ if ./url }}}
			<p>
				<a href="{./url}" target="_blank">[[admin/appearance/themes:homepage]]</a>
			</p>
			{{{ end }}}
		</div>
		<div class="card-footer">
			<a class="btn btn-primary" data-action="use">
				{{{ if ./skin }}}[[admin/appearance/skins:select-skin]]{{{ else }}}[[admin/appearance/themes:select-theme]]{{{ end }}}
			</a>
		</div>
	</div>
</div>
{{{ end }}}

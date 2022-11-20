<!-- BEGIN themes -->
<div class="col-lg-4 col-md-6 col-12 mb-4" data-type="{themes.type}" data-theme="{themes.id}"{{{ if themes.css }}} data-css="{themes.css}" {{{ end }}}>
	<div class="card h-100">
		<img src="{themes.screenshot_url}" class="card-img-top">
		<div class="card-body">
			<h5 class="card-title">{themes.name}</h5>
			<p class="card-text">
				{themes.description}
			</p>

			{{{ if themes.url }}}
			<p>
				<a href="{themes.url}" target="_blank">[[admin/appearance/themes:homepage]]</a>
			</p>
			{{{ end }}}
		</div>
		<div class="card-footer">
			<a class="btn btn-primary" data-action="use">
				{{{ if themes.skin }}}[[admin/appearance/skins:select-skin]]{{{ else }}}[[admin/appearance/themes:select-theme]]{{{ end }}}
			</a>
		</div>
	</div>
</div>
<!-- END themes -->

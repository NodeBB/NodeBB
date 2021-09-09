<!-- BEGIN themes -->
<div class="col-lg-4 col-md-6 col-sm-12 col-xs-12" data-type="{themes.type}" data-theme="{themes.id}"<!-- IF themes.css --> data-css="{themes.css}"<!-- ENDIF themes.css -->>
	<div class="theme-card mdl-card mdl-shadow--2dp">
		<div class="mdl-card__title mdl-card--expand" style="background-image: url('{themes.screenshot_url}');"></div>
		<div class="mdl-card__supporting-text">
			<h2 class="mdl-card__title-text">{themes.name}</h2>
			<p>
				{themes.description}
			</p>

			<!-- IF themes.url -->
			<p>
				<a href="{themes.url}" target="_blank">[[admin/appearance/themes:homepage]]</a>
			</p>
			<!-- ENDIF themes.url -->
		</div>
		<div class="mdl-card__actions mdl-card--border">
			<a class="mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect" data-action="use">
				<!-- IF themes.skin -->[[admin/appearance/skins:select-skin]]<!-- ELSE -->[[admin/appearance/themes:select-theme]]<!-- ENDIF themes.skin -->
			</a>
		</div>
	</div>
</div>
<!-- END themes -->

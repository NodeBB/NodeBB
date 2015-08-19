<!-- BEGIN themes -->
<div class="col-xs-4" data-type="{themes.type}" data-theme="{themes.id}"<!-- IF themes.css --> data-css="{themes.css}"<!-- ENDIF themes.css -->>
	<div class="theme-card mdl-card mdl-shadow--2dp">
		<div class="mdl-card__title mdl-card--expand" style="background-image: url('{themes.screenshot_url}');">
			<h2 class="mdl-card__title-text">{themes.name}</h2>
		</div>
		<div class="mdl-card__supporting-text">
			<p>
				{themes.description}
			</p>

			<!-- IF themes.url -->
			<p>
				<a href="{themes.url}" target="_blank">Homepage</a>
			</p>
			<!-- ENDIF themes.url -->
		</div>
		<div class="mdl-card__actions mdl-card--border">
			<a class="mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect" data-action="use">
				Select Theme
			</a>
		</div>
	</div>
</div>
<!-- END themes -->

<!-- IF showRevert -->
<li data-type="bootswatch" data-theme="" data-css="">
	<div class="pull-right">
		<button class="btn btn-primary pull-right" data-action="use">Revert</button>
	</div>
	<h4>No Skin</h4>
	<p>Remove applied skin and revert back to the base colours</p>
</li>
<!-- ENDIF showRevert -->
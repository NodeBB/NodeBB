<!-- BEGIN themes -->
<li data-type="{themes.type}" data-theme="{themes.id}"<!-- IF themes.css --> data-css="{themes.css}"<!-- ENDIF themes.css -->>
	<img title="{themes.id}" src="{themes.screenshot_url}" />
	<div>
		<div class="pull-right">
			<button class="btn btn-primary" data-action="use">Use</button>
		</div>
		<h4>{themes.name}</h4>
		<p>
			{themes.description}
			<!-- IF themes.url -->
			(<a href="{themes.url}" target="_blank">Homepage</a>)
			<!-- ENDIF themes.url -->
		</p>
	</div>
	<div class="clear"></div>
</li>
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
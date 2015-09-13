<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Crawlability Settings</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<strong>Custom Robots.txt <small>Leave blank for default</small></strong><br />
			<textarea class="form-control" data-field="robots.txt"></textarea>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Sitemap & Feed Settings</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="feeds:disableRSS">
					<span class="mdl-switch__label"><strong>Disable RSS Feeds</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="feeds:disableSitemap">
					<span class="mdl-switch__label"><strong>Disable Sitemap.xml</strong></span>
				</label>
			</div>

			<div class="form-group">
				<label>Number of Topics to display in the Sitemap</label>
				<input class="form-control" type="text" data-field="sitemapTopics" />
			</div>

			<br />
			<p>
				<button id="clear-sitemap-cache" class="btn btn-warning">Clear Sitemap Cache</button>
				<a href="/sitemap.xml" target="_blank" class="btn btn-link">View Sitemap</a>
			</p>

		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
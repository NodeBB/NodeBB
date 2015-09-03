<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:web-crawler.crawlability_settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<strong>[[admin:web-crawler.custom]]</strong><br />
			<textarea class="form-control" data-field="robots.txt"></textarea>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:web-crawler.sitemap_feed_settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="feeds:disableRSS">
					<span class="mdl-switch__label"><strong>[[admin:web-crawler.disable_rss_feeds]]</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="feeds:disableSitemap">
					<span class="mdl-switch__label"><strong>[[admin:web-crawler.disable_sitemap_xml]]</strong></span>
				</label>
			</div>

			<div class="form-group">
				<label>[[admin:web-crawler.number_of_topics_to_display_in_the_sitemap]]</label>
				<input class="form-control" type="text" data-field="sitemapTopics" />
			</div>

			<br />
			<p>
				<button id="clear-sitemap-cache" class="btn btn-warning">[[admin:web-crawler.clear_sitemap_cache]]</button>
				<a href="/sitemap.xml" target="_blank" class="btn btn-link">[[admin:web-crawler.view_sitemap]]</a>
			</p>

		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
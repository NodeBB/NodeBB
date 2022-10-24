<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/web-crawler:crawlability-settings]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<label class="form-label">[[admin/settings/web-crawler:robots-txt]]</label>
			<textarea class="form-control" data-field="robots:txt"></textarea>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/web-crawler:sitemap-feed-settings]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" data-field="feeds:disableRSS">
				<label class="form-check-label">[[admin/settings/web-crawler:disable-rss-feeds]]</label>
			</div>

			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" data-field="feeds:disableSitemap">
				<label class="form-check-label">[[admin/settings/web-crawler:disable-sitemap-xml]]</label>
			</div>

			<div class="mb-3">
				<label class="form-label" for="sitemapTopics">[[admin/settings/web-crawler:sitemap-topics]]</label>
				<input id="sitemapTopics" class="form-control" type="text" data-field="sitemapTopics" />
			</div>

			<p>
				<button id="clear-sitemap-cache" class="btn btn-warning">[[admin/settings/web-crawler:clear-sitemap-cache]]</button>
				<a href="{config.relative_path}/sitemap.xml" target="_blank" class="btn btn-link">[[admin/settings/web-crawler:view-sitemap]]</a>
			</p>

		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
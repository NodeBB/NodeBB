<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="crawlability-settings" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/web-crawler:crawlability-settings]]</h5>
				<div>
					<label class="form-label">[[admin/settings/web-crawler:robots-txt]]</label>
					<textarea class="form-control" data-field="robots:txt"></textarea>
				</div>
			</div>

			<hr/>

			<div id="sitemap-feed-settings" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/web-crawler:sitemap-feed-settings]]</h5>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="feeds:disableRSS" data-field="feeds:disableRSS">
					<label for="feeds:disableRSS" class="form-check-label">[[admin/settings/web-crawler:disable-rss-feeds]]</label>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="feeds:disableSitemap" data-field="feeds:disableSitemap">
					<label for="feeds:disableSitemap" class="form-check-label">[[admin/settings/web-crawler:disable-sitemap-xml]]</label>
				</div>

				<div class="mb-3">
					<label class="form-label" for="sitemapTopics">[[admin/settings/web-crawler:sitemap-topics]]</label>
					<input id="sitemapTopics" class="form-control" type="text" data-field="sitemapTopics" />
				</div>

				<p>
					<button id="clear-sitemap-cache" class="btn btn-sm btn-warning">[[admin/settings/web-crawler:clear-sitemap-cache]]</button>
					<a href="{config.relative_path}/sitemap.xml" target="_blank" class="btn btn-sm btn-light">[[admin/settings/web-crawler:view-sitemap]]</a>
				</p>
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>

<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="server-filtering" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/activitypub:server-filtering]]</h5>
				<form>
					<div class="mb-3">
						<p>[[admin/settings/activitypub:server.filter-help]]</p>
						<p>[[admin/settings/activitypub:server.filter-help-hostname]]</p>
						<p>[[admin/settings/activitypub:count, {instanceCount}]]</p>
						<label for="activitypubFilterList" class="form-label">Filtering list</label>
						<textarea class="form-control" id="activitypubFilterList" data-field="activitypubFilterList" rows="10"></textarea>
					</div>
					<div class="form-check form-switch mb-3">
						<input class="form-check-input" type="checkbox" id="activitypubFilter" data-field="activitypubFilter" />
						<label class="form-check-label" for="activitypubFilter">[[admin/settings/activitypub:server.filter-allow-list]]</label>
					</div>
				</form>
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>

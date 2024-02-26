<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<p class="lead">[[admin/settings/activitypub:intro-lead]]</p>
	<p>[[admin/settings/activitypub:intro-body]]</p>

	<hr />

	<div class="row settings m-0">
		<div class="col-sm-2 col-12 settings-header">[[admin/settings/activitypub:general]]</div>
		<div class="col-sm-10 col-12">
			<form>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" data-field="activitypubEnabled">
					<label class="form-check-label">[[admin/settings/activitypub:enabled]]</label>
					<p class="form-text">[[admin/settings/activitypub:enabled-help]]</p>
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" data-field="activitypubAllowLoopback">
					<label class="form-check-label">[[admin/settings/activitypub:allowLoopback]]</label>
					<p class="form-text">[[admin/settings/activitypub:allowLoopback-help]]</p>
				</div>
			</form>
		</div>
	</div>

	<div class="row settings m-0">
		<div class="col-sm-2 col-12 settings-header">[[admin/settings/activitypub:servers]]</div>
		<div class="col-sm-10 col-12">
			<form>
				<div class="mb-3">
					<p>[[admin/settings/activitypub:server.filter-help]]</p>
					<p>[[admin/settings/activitypub:count, 0]]</p>
					<label for="activitypubFilterList" class="form-label">Filtering list</label>
					<textarea class="form-control" id="activitypubFilterList" rows="10" disabled="disabled"></textarea>
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" data-field="activitypubFilter" disabled="disabled" />
					<label class="form-check-label">[[admin/settings/activitypub:server.filter-allow-list]]</label>
				</div>
			</form>
		</div>
	</div>
</div>

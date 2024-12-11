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
		<div class="col-sm-2 col-12 settings-header">[[admin/settings/activitypub:probe]]</div>
		<div class="col-sm-10 col-12">
			<form>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" data-field="activitypubProbe">
					<label class="form-check-label">[[admin/settings/activitypub:probe-enabled]]</label>
					<p class="form-text">[[admin/settings/activitypub:probe-enabled-help]]</p>
				</div>
				<div class="mb-3">
					<label class="form-label" for="activitypubProbeTimeout">[[admin/settings/activitypub:probe-timeout]]</label>
					<input type="number" id="activitypubProbeTimeout" name="activitypubProbeTimeout" data-field="activitypubProbeTimeout" title="[[admin/settings/activitypub:probe-timeout]]" class="form-control" />
					<div class="form-text">
						[[admin/settings/activitypub:probe-timeout-help]]
					</div>
				</div>
			</form>
		</div>
	</div>

	<div class="row settings m-0">
		<div class="col-sm-2 col-12 settings-header">[[admin/settings/activitypub:pruning]]</div>
		<div class="col-sm-10 col-12">
			<form>
				<div class="mb-3">
					<label class="form-label" for="activitypubContentPruneDays">[[admin/settings/activitypub:content-pruning]]</label>
					<input type="number" id="activitypubContentPruneDays" name="activitypubContentPruneDays" data-field="activitypubContentPruneDays" title="[[admin/settings/activitypub:content-pruning]]" class="form-control" />
					<div class="form-text">
						[[admin/settings/activitypub:content-pruning-help]]
					</div>
				</div>
				<div class="mb-3">
					<label class="form-label" for="activitypubUserPruneDays">[[admin/settings/activitypub:user-pruning]]</label>
					<input type="number" id="activitypubUserPruneDays" name="activitypubUserPruneDays" data-field="activitypubUserPruneDays" title="[[admin/settings/activitypub:user-pruning]]" class="form-control" />
					<div class="form-text">
						[[admin/settings/activitypub:user-pruning-help]]
					</div>
				</div>
			</form>
		</div>
	</div>

	<div class="row settings m-0">
		<div class="col-sm-2 col-12 settings-header">[[admin/settings/activitypub:server-filtering]]</div>
		<div class="col-sm-10 col-12">
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
</div>

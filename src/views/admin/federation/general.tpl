<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">

			<p class="lead">[[admin/settings/activitypub:intro-lead]]</p>
			<p>[[admin/settings/activitypub:intro-body]]</p>

			<hr />

			<div id="general" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/activitypub:general]]</h5>
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
					<div class="mb-3">
						<label class="form-label" for="activitypubParentTraversalDepth">[[admin/settings/activitypub:parentTraversalDepth]]</label>
						<input type="number" id="activitypubParentTraversalDepth" name="activitypubParentTraversalDepth" data-field="activitypubParentTraversalDepth" title="[[admin/settings/activitypub:parentTraversalDepth]]" class="form-control" />
						<div class="form-text">
							[[admin/settings/activitypub:parentTraversalDepth-help]]
						</div>
					</div>
					<div class="mb-3">
						<label class="form-label" for="activitypubPublicKeyFetchRateLimit">[[admin/settings/activitypub:publicKeyFetchRateLimit]]</label>
						<input type="number" id="activitypubPublicKeyFetchRateLimit" name="activitypubPublicKeyFetchRateLimit" data-field="activitypubPublicKeyFetchRateLimit" title="[[admin/settings/activitypub:publicKeyFetchRateLimit]]" class="form-control" />
						<div class="form-text">
							[[admin/settings/activitypub:publicKeyFetchRateLimit-help]]
						</div>
					</div>
				</form>
			</div>

			<div id="probe" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/activitypub:probe]]</h5>
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

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>

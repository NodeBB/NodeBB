<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="outgoing" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/activitypub:content.outgoing]]</h5>
				<form>
					<div class="mb-3">
						<label class="form-label" for="activitypubSummaryLimit">[[admin/settings/activitypub:content.summary-limit]]</label>
						<input type="number" id="activitypubSummaryLimit" name="activitypubSummaryLimit" data-field="activitypubSummaryLimit" title="[[admin/settings/activitypub:content.summary-limit]]" class="form-control" />
						<div class="form-text">
							[[admin/settings/activitypub:content.summary-limit-help]]
						</div>
					</div>
					<div class="mb-3">
						<label class="form-label" for="activitypubBreakString">[[admin/settings/activitypub:content.break-string]]</label>
						<input type="text" id="activitypubBreakString" name="activitypubBreakString" data-field="activitypubBreakString" title="[[admin/settings/activitypub:content.break-string]]" class="form-control" />
						<div class="form-text">
							[[admin/settings/activitypub:content.break-string-help]]
						</div>
					</div>
				</form>
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>

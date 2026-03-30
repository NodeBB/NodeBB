<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="pruning" class="mb-4">
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

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>

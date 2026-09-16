<form role="form" id="hashtagForm">
	<div class="mb-3">
		<label class="form-label" for="hashtagTag">{{tx("admin/settings/activitypub:hashtags.modal.tag")}}</label>
		<input type="text" id="hashtagTag" name="tag" class="form-control" placeholder="nodebb" required />
		<div class="form-text">{{tx("admin/settings/activitypub:hashtags.modal.tag-help")}}</div>
	</div>
	<div class="mb-3">
		<label class="form-label">{{tx("admin/settings/activitypub:hashtags.modal.category")}}</label>
		<div class="d-block">
			<!-- IMPORT admin/partials/category/selector-dropdown-left.tpl -->
		</div>
		<input type="hidden" name="cid" />
	</div>
</form>

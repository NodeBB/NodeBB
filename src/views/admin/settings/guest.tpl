<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/guest:settings]]</div>
	<div class="col-sm-10 col-12">
		<form role="form" class="mb-3">
			<div class="form-check">
				<input class="form-check-input" type="checkbox" data-field="allowGuestHandles">
				<label class="form-check-label">[[admin/settings/guest:handles.enabled]]</label>
			</div>
			<p class="form-text">
				[[admin/settings/guest:handles.enabled-help]]
			</p>
		</form>
		<form role="form" class="mb-3">
			<div class="form-check">
				<input class="form-check-input" type="checkbox" data-field="guestsIncrementTopicViews">
				<label class="form-check-label">[[admin/settings/guest:topic-views.enabled]]</label>
			</div>
		</form>
		<form role="form" class="mb-3">
			<div class="form-check">
				<input class="form-check-input" type="checkbox" data-field="allowGuestReplyNotifications">
				<label class="form-check-label">[[admin/settings/guest:reply-notifications.enabled]]</label>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
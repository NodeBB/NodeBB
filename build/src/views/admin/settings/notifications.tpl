<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/notifications:notifications]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="mb-3">
				<label class="form-label">[[admin/settings/notifications:welcome-notification]]</label>
				<textarea class="form-control" data-field="welcomeNotification"></textarea>
			</div>
			<div class="mb-3">
				<label class="form-label">[[admin/settings/notifications:welcome-notification-link]]</label>
				<input type="text" class="form-control" data-field="welcomeLink">
			</div>
			<div class="mb-3">
				<label class="form-label">[[admin/settings/notifications:welcome-notification-uid]]</label>
				<input type="text" class="form-control" data-field="welcomeUid">
			</div>
			<div class="mb-3">
				<label class="form-label">[[admin/settings/notifications:post-queue-notification-uid]]</label>
				<input type="text" class="form-control" data-field="postQueueNotificationUid">
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="notifications" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header hidden">[[admin/settings/notifications:notifications]]</h5>
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

			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>


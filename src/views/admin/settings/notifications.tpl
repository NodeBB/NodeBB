<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/notifications:notifications]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<strong>[[admin/settings/notifications:welcome-notification]]</strong><br /> <textarea class="form-control" data-field="welcomeNotification"></textarea><br />
			<strong>[[admin/settings/notifications:welcome-notification-link]]</strong><br /> <input type="text" class="form-control" data-field="welcomeLink"><br />
			<strong>[[admin/settings/notifications:welcome-notification-uid]]</strong><br /> <input type="text" class="form-control" data-field="welcomeUid"><br />
			<strong>[[admin/settings/notifications:post-queue-notification-uid]]</strong><br /> <input type="text" class="form-control" data-field="postQueueNotificationUid"><br />
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="useFullnameInNotifications">
					<span class="mdl-switch__label"><strong>[[admin/settings/notifications:use-fullname]]</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
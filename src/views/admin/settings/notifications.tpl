<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/notifications:notifications]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<strong>[[admin/settings/notifications:welcome-notification]]</strong><br /> <textarea class="form-control" data-field="welcomeNotification"></textarea><br />
			<strong>[[admin/settings/notifications:welcome-notification-link]]</strong><br /> <input type="text" class="form-control" data-field="welcomeLink"><br />
			<strong>[[admin/settings/notifications:welcome-notification-uid]]</strong><br /> <input type="text" class="form-control" data-field="welcomeUid"><br />

			<strong>[[admin/settings/notifications:notification-alert-timeout]]</strong><br /> <input type="text" class="form-control" data-field="notificationAlertTimeout" placeholder="5000"><br />
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Notifications</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<strong>Welcome Notification</strong><br /> <textarea class="form-control" data-field="welcomeNotification"></textarea><br />
			<strong>Welcome Notification Link</strong><br /> <input type="text" class="form-control" data-field="welcomeLink"><br />
			<strong>Default Upvote Setting</label>
			<select class="form-control" data-field="upvoteNotifications">
				<option value="all">All</option>
				<option value="thresholds">1st, 5th, 10th, 50th, 50xth</option>
				<option value="first">First Only</option>
				<option value="none">None</option>
			</select><br />
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->

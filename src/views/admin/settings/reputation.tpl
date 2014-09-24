<!-- IMPORT admin/settings/header.tpl -->

<form>
	<div class="alert alert-warning">
		<div class="checkbox">
			<label>
				<input type="checkbox" data-field="reputation:disabled"> <strong>Disable Reputation System</strong>
			</label>
		</div>
		<div class="checkbox">
			<label>
				<input type="checkbox" data-field="downvote:disabled"> <strong>Disable Down Voting</trong>
			</label>
		</div>
	</div>

	<div class="alert alert-warning">
		<h3>Privilege Thresholds</h3>
		<p>Use <strong>privilege thresholds</strong> to manage how much reputation a user must gain to receive moderator access.</p><br />
		<strong>Manage Thread</strong><br /> <input type="text" class="form-control" value="1000" data-field="privileges:manage_topic"><br />
		<strong>Manage Content</strong><br /> <input type="text" class="form-control" value="1000" data-field="privileges:manage_content"><br />
		<div class="checkbox">
			<label>
				<input type="checkbox" data-field="privileges:disabled"> <strong>Disable Privilege Threshold System</strong>
			</label>
		</div>
	</div>

	<div class="alert alert-warning">
		<h3>Activity Thresholds</h3>
		<strong>Minimum reputation to downvote posts</strong><br /> <input type="text" class="form-control" data-field="privileges:downvote"><br />
		<strong>Minimum reputation to flag posts</strong><br /> <input type="text" class="form-control" data-field="privileges:flag"><br />
	</div>
</form>

<!-- IMPORT admin/settings/footer.tpl -->
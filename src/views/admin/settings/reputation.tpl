<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
	<div class="panel-heading">Reputation Settings</div>
	<div class="panel-body">
		<form>
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
		</form>
	</div>
</div>


<div class="panel panel-default">
	<div class="panel-heading">Privilege Thresholds</div>
	<div class="panel-body">
		<form>
			<p class="help-block">
				Use privilege thresholds to manage how much reputation a user must gain to receive moderator access.
			</p>
			<strong>Manage Thread</strong><br /> <input type="text" class="form-control" value="1000" data-field="privileges:manage_topic"><br />
			<strong>Manage Content</strong><br /> <input type="text" class="form-control" value="1000" data-field="privileges:manage_content"><br />
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="privileges:disabled"> <strong>Disable Privilege Threshold System</strong>
				</label>
			</div>
		</form>
	</div>
</div>

<div class="panel panel-default">
	<div class="panel-heading">Activity Thresholds</div>
	<div class="panel-body">
		<form>
			<strong>Minimum reputation to downvote posts</strong><br /> <input type="text" class="form-control" data-field="privileges:downvote"><br />
			<strong>Minimum reputation to flag posts</strong><br /> <input type="text" class="form-control" data-field="privileges:flag"><br />
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
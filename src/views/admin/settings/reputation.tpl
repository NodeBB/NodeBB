<!-- IMPORT admin/settings/header.tpl -->


<div class="row">
	<div class="col-xs-2 settings-header">Reputation Settings</div>
	<div class="col-xs-10">
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


<div class="row">
	<div class="col-xs-2 settings-header">Activity Thresholds</div>
	<div class="col-xs-10">
		<form>
			<strong>Minimum reputation to downvote posts</strong><br /> <input type="text" class="form-control" placeholder="0" data-field="privileges:downvote"><br />
			<strong>Minimum reputation to flag posts</strong><br /> <input type="text" class="form-control" placeholder="0" data-field="privileges:flag"><br />
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
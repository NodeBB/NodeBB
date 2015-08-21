<div class="registration">
	<table class="table table-striped users-list">
		<tr>
			<th>Name</th>
			<th>Email</th>
			<th>IP</th>
			<th>Time</th>
			<th></th>
		</tr>
		<!-- IF !users.length -->
		<p>
			There are no users in the registration queue. To enable this feature go to <a href="{config.relative_path}/admin/settings/user#authentication">Settings -> User -> Authentication</a> and set <strong>Registration Type</strong> to "Admin Approval".
		</p>
		<!-- ENDIF !users.length -->
		<!-- BEGIN users -->
		<tr data-username="{users.username}">
			<td>
				<!-- IF users.usernameSpam -->
				<i class="fa fa-times-circle text-danger" title="Frequency: {users.spamData.username.frequency} Appears: {users.spamData.username.appears} Confidence: {users.spamData.username.confidence}"></i>
				<!-- ELSE -->
				<i class="fa fa-check text-success"></i>
				<!-- ENDIF users.usernameSpam -->
				{users.username}
			</td>
			<td>
				<!-- IF users.emailSpam -->
				<i class="fa fa-times-circle text-danger" title="Frequency: {users.spamData.email.frequency} Appears: {users.spamData.email.appears}"></i>
				<!-- ELSE -->
				<i class="fa fa-check text-success"></i>
				<!-- ENDIF users.emailSpam -->
				{users.email}
			</td>
			<td>
				<!-- IF users.ipSpam -->
				<i class="fa fa-times-circle text-danger" title="Frequency: {users.spamData.ip.frequency} Appears: {users.spamData.ip.appears}"></i>
				<!-- ELSE -->
				<i class="fa fa-check text-success"></i>
				<!-- ENDIF users.ipSpam -->
				{users.ip}
			</td>
			<td>
				<span class="timeago" title="{users.timestamp}"></span>
			</td>
			<td>
				<div class="btn-group pull-right">
					<button class="btn btn-success btn-xs" data-action="accept"><i class="fa fa-check"></i></button>
					<button class="btn btn-danger btn-xs" data-action="delete"><i class="fa fa-times"></i></button>
				</div>
			</td>
		</tr>
		<!-- END users -->
	</table>
</div>
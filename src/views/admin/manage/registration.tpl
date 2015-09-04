<div class="registration">
	<table class="table table-striped users-list">
		<tr>
			<th>[[admin:registration.name]]</th>
			<th>[[admin:registration.email]]</th>
			<th>[[admin:registration.ip]]</th>
			<th>[[admin:registration.time]]</th>
			<th></th>
		</tr>
		<!-- IF !users.length -->
		<p>
			[[admin:registration.notice1]]<a href="{config.relative_path}/admin/settings/user">[[admin:registration.notice2]]</a>[[admin:registration.notice3]]
		</p>
		<!-- ENDIF !users.length -->
		<!-- BEGIN users -->
		<tr data-username="{users.username}">
			<td>
				<!-- IF users.usernameSpam -->
				<i class="fa fa-times-circle text-danger" title="[[admin:registration.frequency]]: {users.spamData.username.frequency} [[admin:registration.appears]]: {users.spamData.username.appears} [[admin:registration.appears]]: {users.spamData.username.confidence}"></i>
				<!-- ELSE -->
				<i class="fa fa-check text-success"></i>
				<!-- ENDIF users.usernameSpam -->
				{users.username}
			</td>
			<td>
				<!-- IF users.emailSpam -->
				<i class="fa fa-times-circle text-danger" title="[[admin:registration.frequency]]: {users.spamData.email.frequency} [[admin:registration.appears]]: {users.spamData.email.appears}"></i>
				<!-- ELSE -->
				<i class="fa fa-check text-success"></i>
				<!-- ENDIF users.emailSpam -->
				{users.email}
			</td>
			<td>
				<!-- IF users.ipSpam -->
				<i class="fa fa-times-circle text-danger" title="[[admin:registration.frequency]]: {users.spamData.ip.frequency} [[admin:registration.appears]]: {users.spamData.ip.appears}"></i>
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

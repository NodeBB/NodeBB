<div class="row dashboard">
	<div class="col-xs-12">
		<a class="btn btn-link" href="{config.relative_path}/admin/dashboard">
			<i class="fa fa-chevron-left"></i>
			[[admin/dashboard:back-to-dashboard]]
		</a>

		<!-- IMPORT admin/partials/dashboard/graph.tpl -->
		<!-- IMPORT admin/partials/dashboard/stats.tpl -->

		<div class="alert alert-info">[[admin/dashboard:details.logins-static, {loginDays}]]</div>
		<table class="table table-striped">
			<thead>
				<th class="text-muted">[[admin/manage/users:users.username]]</th>
				<th data-sort="joindate">[[admin/dashboard:details.logins-login-time]]</th>
			</thead>
			<tbody>
				{{{ if !sessions.length}}}
				<tr>
					<td colspan=4" class="text-center"><em>[[admin/dashboard:details.no-logins]]</em></td>
				</tr>
				{{{ end }}}
				{{{ each sessions }}}
				<tr>
					<td>
						<a href="{config.relative_path}/uid/{./user.uid}">{buildAvatar(./user, "sm", true)} {../username}</a>
						{function.userAgentIcons} {../browser} {../version} on {../platform}
					</td>
					<td><span class="timeago" title="{./datetimeISO}"></span></td>
				</tr>
				{{{ end }}}
			</tbody>
		</table>
	</div>
</div>
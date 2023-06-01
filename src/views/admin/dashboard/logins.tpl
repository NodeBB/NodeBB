<div class="row dashboard px-lg-4">
	<div class="col-12">
		<!-- IMPORT admin/partials/dashboard/graph.tpl -->
		<!-- IMPORT admin/partials/dashboard/stats.tpl -->

		<div class="alert alert-info">[[admin/dashboard:details.logins-static, {loginDays}]]</div>
		<div class="table-responsive">
			<table class="table text-sm">
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
						<td class="d-flex gap-2 align-items-center">
							<a href="{config.relative_path}/uid/{./user.uid}">{buildAvatar(./user, "18px", true)}</a>
							<a href="{config.relative_path}/uid/{./user.uid}">{./user.username}</a>
							{function.userAgentIcons} {../browser} {../version} on {../platform}
						</td>
						<td><span class="timeago" title="{./datetimeISO}"></span></td>
					</tr>
					{{{ end }}}
				</tbody>
			</table>
		</div>
	</div>
</div>
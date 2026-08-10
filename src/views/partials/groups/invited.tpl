<div style="max-height: 500px; overflow: auto;">
	<div component="groups/invited/alert" class="alert alert-info {{{ if group.invited.length }}}hidden{{{ end }}}">{{tx("groups:invited.none")}}</div>
	<table component="groups/invited" class="table table-hover">
		<tbody>
			{{{ each group.invited }}}
			<tr data-uid="{group.invited.uid}" class="align-middle">
				<td class="member-name p-2 d-flex align-items-center justify-content-between">
					<div class="d-flex align-items-center gap-2">
						<a class="text-decoration-none" href="{config.relative_path}/user/{group.invited.userslug}">{{buildAvatar(group.invited, "24px", true)}}</a>
						<a href="{config.relative_path}/user/{group.invited.userslug}">{group.invited.username}</a>
					</div>
					<button class="btn btn-outline-secondary btn-sm text-nowrap" data-action="rescindInvite">{{tx("groups:invited.uninvite")}}</button>
				</td>
			</tr>
			{{{ end }}}
		</tbody>
	</table>
</div>
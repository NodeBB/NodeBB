<label class="text-xs text-muted">[[groups:invited.search]]</label>
<div class="input-group mb-2">
	<input class="form-control" type="text" component="groups/members/invite"/>
	<span class="input-group-text search-button"><i class="fa fa-search"></i></span>
</div>

<div class="mb-2">
	<label class="text-xs text-muted">[[groups:bulk-invite-instructions]]</label>
	<textarea class="form-control" component="groups/members/bulk-invite"></textarea>
</div>

<div class="mb-2 clearfix">
	<button type="button" class="btn btn-primary btn-sm float-end" component="groups/members/bulk-invite-button">[[groups:bulk-invite]]</button>
</div>

<div style="max-height: 500px; overflow: auto;">
	<div component="groups/invited/alert" class="alert alert-info {{{ if group.invited.length }}}hidden{{{ end }}}">[[groups:invited.none]]</div>
	<table component="groups/invited" class="table table-hover">
		<tbody>
			{{{ each group.invited }}}
			<tr data-uid="{group.invited.uid}" class="align-middle">
				<td class="member-name p-2 d-flex align-items-center justify-content-between">
					<div class="d-flex align-items-center gap-2">
						<a class="text-decoration-none" href="{config.relative_path}/user/{group.invited.userslug}">{{buildAvatar(group.invited, "24px", true)}}</a>
						<a href="{config.relative_path}/user/{group.invited.userslug}">{group.invited.username}</a>
					</div>
					<button class="btn btn-outline-secondary btn-sm text-nowrap" data-action="rescindInvite">[[groups:invited.uninvite]]</button>
				</td>
			</tr>
			{{{ end }}}
		</tbody>
	</table>
</div>
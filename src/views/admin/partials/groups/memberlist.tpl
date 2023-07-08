<div class="d-flex justify-content-between mb-2">
	{{{ if group.isOwner }}}
	<button component="groups/members/add" type="button" class="btn btn-primary btn-sm text-nowrap" title="[[groups:details.add-member]]">[[groups:details.add-member]]</button>
	{{{ end }}}
	<div>
		<div class="input-group">
			<input class="form-control form-control-sm" type="text" component="groups/members/search" placeholder="[[global:search]]"/>
			<span class="input-group-text search-button px-2"><i class="fa fa-fw fa-search"></i></span>
		</div>
	</div>
</div>

<div component="groups/members" data-nextstart="{group.membersNextStart}" class="overflow-auto" style="max-height: 500px;">
	<table  class="table table-hover">
		<tbody>
		{{{ each group.members }}}
		<tr data-uid="{group.members.uid}">
			<td class="member-name d-flex justify-content-between align-items-center">
				<div class="d-flex align-items-center gap-2">
					<a href="{config.relative_path}/user/{group.members.userslug}">{buildAvatar(group.members, "24px", true)}</a>
					<a href="{config.relative_path}/user/{group.members.userslug}">{group.members.username}</a> <i title="[[groups:owner]]" class="user-owner-icon fa fa-star text-warning {{{ if !group.members.isOwner }}}invisible{{{ end }}}"></i>
				</div>

				{{{ if group.isOwner }}}
				<div class="owner-controls d-flex gap-1">
					<a class="btn btn-light btn-sm" href="#" data-action="toggleOwnership" title="[[groups:details.grant]]">
						<i class="fa fa-star text-warning"></i>
					</a>

					<a class="btn btn-light btn-sm" href="#" data-action="kick" title="[[groups:details.kick]]">
						<i class="fa fa-ban text-danger"></i>
					</a>
				</div>
				{{{ end }}}
			</td>
		</tr>
		{{{ end }}}
		</tbody>
	</table>
</div>
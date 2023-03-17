<div class="row mb-2">
	{{{ if group.isOwner }}}
	<div class="col-lg-1">
		<button component="groups/members/add" type="button" class="btn btn-primary" title="[[groups:details.add-member]]"><i class="fa fa-user-plus"></i></button>
	</div>
	{{{ end }}}
	<div class="{{{ if group.isOwner }}}col-lg-11{{{ else }}}col-lg-12{{{ end }}}">
		<div class="input-group">
			<input class="form-control" type="text" component="groups/members/search" placeholder="[[global:search]]"/>
			<span class="input-group-text search-button px-2"><i class="fa fa-search"></i></span>
		</div>
	</div>
</div>

<table component="groups/members" class="table table-striped table-hover" data-nextstart="{group.membersNextStart}">
	<tbody>
	{{{ each group.members }}}
	<tr data-uid="{group.members.uid}">
		<td>
			<a href="{config.relative_path}/user/{group.members.userslug}">{buildAvatar(group.members, "24px", true)}</a>
		</td>
		<td class="member-name">
			<a href="{config.relative_path}/user/{group.members.userslug}">{group.members.username}</a> <i title="[[groups:owner]]" class="user-owner-icon fa fa-star text-warning
			{{{ if !group.members.isOwner }}}invisible{{{ end }}}"></i>

			{{{ if group.isOwner }}}
			<div class="owner-controls btn-group float-end">
				<a class="btn btn-sm" href="#" data-ajaxify="false" data-action="toggleOwnership" title="[[groups:details.grant]]">
					<i class="fa fa-star"></i>
				</a>

				<a class="btn btn-sm" href="#" data-ajaxify="false" data-action="kick" title="[[groups:details.kick]]">
					<i class="fa fa-ban"></i>
				</a>
			</div>
			{{{ end }}}
		</td>
	</tr>
	{{{ end }}}
	</tbody>
</table>
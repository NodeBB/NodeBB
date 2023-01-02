<div class="row">
	<!-- IF group.isOwner -->
	<div class="col-lg-2">
		<button component="groups/members/add" type="button" class="btn btn-primary" title="[[groups:details.add-member]]"><i class="fa fa-user-plus"></i></button>
	</div>
	<!-- ENDIF group.isOwner -->
	<div class="<!-- IF group.isOwner -->col-lg-10<!-- ELSE -->col-lg-12<!-- ENDIF group.isOwner -->">
		<div class="input-group">
			<input class="form-control" type="text" component="groups/members/search" placeholder="[[global:search]]"/>
			<span class="input-group-addon search-button"><i class="fa fa-search"></i></span>
		</div>
	</div>
</div>

<table component="groups/members" class="table table-striped table-hover" data-nextstart="{group.membersNextStart}">
	<tbody>
	{{{each group.members}}}
	<tr data-uid="{group.members.uid}">
		<td>
			<a href="{config.relative_path}/user/{group.members.userslug}">{buildAvatar(group.members, "sm", true)}</a>
		</td>
		<td class="member-name">
			<a href="{config.relative_path}/user/{group.members.userslug}">{group.members.username}</a> <i title="[[groups:owner]]" class="fa fa-star text-warning <!-- IF !group.members.isOwner -->invisible<!-- ENDIF !group.members.isOwner -->"></i>

			<!-- IF group.isOwner -->
			<div class="owner-controls btn-group pull-right">
				<a class="btn btn-sm" href="#" data-ajaxify="false" data-action="toggleOwnership" title="[[groups:details.grant]]">
					<i class="fa fa-star"></i>
				</a>

				<a class="btn btn-sm" href="#" data-ajaxify="false" data-action="kick" title="[[groups:details.kick]]">
					<i class="fa fa-ban"></i>
				</a>
			</div>
			<!-- ENDIF group.isOwner -->
		</td>
	</tr>
	{{{end}}}
	</tbody>
</table>
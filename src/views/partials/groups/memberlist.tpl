<div class="d-flex {{{ if group.isOwner }}}justify-content-between{{{ else }}}justify-content-end{{{ end }}} mb-3">
	{{{ if isAdmin }}}
	<div class="flex-shrink-0">
		<button component="groups/members/add" type="button" class="btn btn-primary btn-sm me-3" title="{{tx("groups:details.add-member")}}"><i class="fa fa-user-plus"></i> {{tx("groups:details.add-member")}}</button>
	</div>
	{{{ end }}}
	<div>
		<div class="input-group">
			<input class="form-control form-control-sm" type="text" component="groups/members/search" placeholder="{{tx("global:search")}}"/>
			<button class="btn btn-primary btn-sm search-button" type="button">
				<i class="fa fa-search"></i>
			</button>
		</div>
	</div>
</div>

<div component="groups/members" data-nextstart="{group.membersNextStart}" class="mb-5" style="max-height: 500px; overflow: auto;">
	<table class="table table-hover">
		<tbody>
			{{{ each group.members }}}
			<tr class="w-100" data-uid="{group.members.uid}" data-isowner="{{{ if group.members.isOwner }}}1{{{ else }}}0{{{ end }}}">
				<td class="member-name p-2 w-100 ">
					<div class="d-flex align-items-center justify-content-between gap-3">
						<div class="d-flex align-items-center justify-content-between gap-2 flex-1">
							<div>
								<a class="text-decoration-none" href="{config.relative_path}/user/{group.members.userslug}">{{buildAvatar(group.members, "24px", true)}}</a>
								<a class="align-text-top" href="{config.relative_path}/user/{group.members.userslug}">{group.members.username}</a>
								<span component="groups/owner/icon" class="badge text-body border border-gray-300 text-xs {{{ if !group.members.isOwner }}}d-none{{{ end }}}">
									<span class="fw-bold">{{tx("groups:owner")}}</span>
								</span>
							</div>
							<div>
								<span class="badge text-body border border-gray-300 text-xs fw-normal">
									<span>{formattedNumber(./postcount)}</span>
									<span class="text-lowercase fw-normal">{{tx("global:posts")}}</span>
								</span>

								<span class="badge text-body border border-gray-300 text-xs fw-normal">
									<span>{formattedNumber(./reputation)}</span>
									<span class="text-lowercase">{{tx("global:reputation")}}</span>
								</span>
							</div>
						</div>

						{{{ if group.isOwner }}}
						<div class="owner-controls d-flex gap-1">
							<a class="btn btn-light btn-sm" href="#" data-action="toggleOwnership" title="{{tx("groups:details.grant")}}">
								<i class="fa fa-star text-warning"></i>
							</a>

							<a class="btn btn-light btn-sm" href="#" data-action="kick" title="{{tx("groups:details.kick")}}">
								<i class="fa fa-ban text-danger"></i>
							</a>
						</div>
						{{{ end }}}
					</div>
				</td>
			</tr>
			{{{end}}}
		</tbody>
	</table>
</div>
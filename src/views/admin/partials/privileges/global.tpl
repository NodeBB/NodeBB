<label>[[admin/manage/privileges:group-privileges]]</label>
<div class="table-responsive">
	<table class="table privilege-table text-sm">
		<thead>
			{{{ if !isAdminPriv }}}
			<tr class="privilege-table-header">
				<th class="privilege-filters" colspan="100">
					<div component="privileges/groups/filters" class="btn-toolbar justify-content-end gap-1 flex-nowrap">
						<button type="button" data-filter="viewing" class="btn btn-outline-secondary btn-sm text-nowrap">[[admin/manage/categories:privileges.section-viewing]]</button>
						<button type="button" data-filter="posting" class="btn btn-outline-secondary btn-sm text-nowrap">[[admin/manage/categories:privileges.section-posting]]</button>
						<button type="button" data-filter="moderation" class="btn btn-outline-secondary btn-sm text-nowrap">[[admin/manage/categories:privileges.section-moderation]]</button>
						{{{ if privileges.columnCountGroupOther }}}
						<button type="button" data-filter="other" class="btn btn-outline-secondary btn-sm text-nowrap">[[admin/manage/categories:privileges.section-other]]</button>
						{{{ end }}}
					</div>
				</th>
			</tr><tr><!-- zebrastripe reset --></tr>
			{{{ end }}}
			<tr>
				<th colspan="2">[[admin/manage/categories:privileges.section-group]]</th>
				<th class="text-center">[[admin/manage/privileges:select-clear-all]]</th>
				{{{ each privileges.labelData }}}
				<th class="text-center" data-type="{./type}">{./label}</th>
				{{{ end }}}
			</tr>
		</thead>
		<tbody>
			{{{ each privileges.groups }}}
			<tr data-group-name="{privileges.groups.nameEscaped}" data-private="{{{ if privileges.groups.isPrivate }}}1{{{ else }}}0{{{ end }}}">
				<td>
					{{{ if privileges.groups.isPrivate }}}
						{{{ if (privileges.groups.name == "banned-users") }}}
						<i class="fa fa-fw fa-exclamation-triangle text-muted" title="[[admin/manage/categories:privileges.inheritance-exception]]"></i>
						{{{ else }}}
						<i class="fa fa-fw fa-lock text-muted" title="[[admin/manage/categories:privileges.group-private]]"></i>
						{{{ end }}}
					{{{ else }}}
					<i class="fa fa-fw fa-none"></i>
					{{{ end }}}
					{privileges.groups.name}
				</td>
				<td></td>
				<td class="text-center"><input autocomplete="off" type="checkbox" class="checkbox-helper"></td>
				{function.spawnPrivilegeStates, cid, privileges.groups.name, ../privileges, ../types}
			</tr>
			{{{ end }}}
		</tbody>
		<tfoot>
			<tr>
				<td colspan="3"></td>
				<td colspan="{privileges.keys.groups.length}">
					<div class="btn-toolbar justify-content-end">
						<button type="button" class="btn btn-sm btn-outline-secondary" data-ajaxify="false" data-action="search.group">
							<i class="fa fa-users"></i>
							[[admin/manage/categories:privileges.search-group]]
						</button>
					</div>
				</td>
			</tr>
		</tfoot>
	</table>
</div>
<div class="form-text">
	[[admin/manage/categories:privileges.inherit]]
</div>
<hr/>
<label>[[admin/manage/privileges:user-privileges]]</label>
<div class="table-responsive">
	<table class="table privilege-table text-sm">
		<thead>
			{{{ if !isAdminPriv }}}
			<tr class="privilege-table-header">
				<th class="privilege-filters" colspan="100">
					<div class="btn-toolbar justify-content-end gap-1 flex-nowrap">
					<button type="button" data-filter="viewing" class="btn btn-outline-secondary btn-sm text-nowrap">[[admin/manage/categories:privileges.section-viewing]]</button>
					<button type="button" data-filter="posting" class="btn btn-outline-secondary btn-sm text-nowrap">[[admin/manage/categories:privileges.section-posting]]</button>
					<button type="button" data-filter="moderation" class="btn btn-outline-secondary btn-sm text-nowrap">[[admin/manage/categories:privileges.section-moderation]]</button>
					{{{ if privileges.columnCountUserOther }}}
					<button type="button" data-filter="other" class="btn btn-outline-secondary btn-sm text-nowrap">[[admin/manage/categories:privileges.section-other]]</button>
					{{{ end }}}
					</div>
				</th>
			</tr><tr><!-- zebrastripe reset --></tr>
			{{{ end }}}
			<tr>
				<th colspan="2">[[admin/manage/categories:privileges.section-user]]</th>
				<th class="text-center">[[admin/manage/privileges:select-clear-all]]</th>
				{{{ each privileges.labelData }}}
				<th class="text-center" data-type="{./type}">{./label}</th>
				{{{ end }}}
			</tr>
		</thead>
		<tbody>
			{{{ each privileges.users }}}
			<tr data-uid="{privileges.users.uid}"{{{ if privileges.users.banned }}} data-banned{{{ end }}}>
				<td>
					{buildAvatar(privileges.users, "24px", true)}
					{{{ if privileges.users.banned }}}
						<i class="ban fa fa-gavel text-danger" title="[[admin/manage/categories:privileges.banned-user-inheritance]]"></i>
					{{{ end }}}
					{privileges.users.username}
				</td>
				<td>
					<!-- need this empty -->
				</td>
				<td class="text-center"><input autocomplete="off" type="checkbox" class="checkbox-helper"></td>
				{function.spawnPrivilegeStates, cid, privileges.users.username, ../privileges, ../types}
			</tr>
			{{{ end }}}
		</tbody>
		<tfoot>
			<tr>
				<td colspan="3"></td>
				<td colspan="{privileges.keys.users.length}">
					<div class="btn-toolbar justify-content-end">
						<button type="button" class="btn btn-sm btn-outline-secondary" data-ajaxify="false" data-action="search.user">
							<i class="fa fa-user"></i>
							[[admin/manage/categories:privileges.search-user]]
						</button>
					</div>
				</td>
			</tr>
		</tfoot>
	</table>
</div>

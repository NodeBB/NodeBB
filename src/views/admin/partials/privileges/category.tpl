<label>[[admin/manage/privileges:group-privileges]]</label>
<div class="table-responsive">
	<table class="table privilege-table text-sm">
		<thead>
			<tr class="privilege-table-header">
				<th class="privilege-filters" colspan="100">
					<div component="privileges/groups/filters" class="btn-toolbar justify-content-end gap-1">
						<button type="button" data-filter="viewing" class="btn btn-outline-secondary btn-sm">[[admin/manage/categories:privileges.section-viewing]]</button>
						<button type="button" data-filter="posting" class="btn btn-outline-secondary btn-sm">[[admin/manage/categories:privileges.section-posting]]</button>
						<button type="button" data-filter="moderation" class="btn btn-outline-secondary btn-sm">[[admin/manage/categories:privileges.section-moderation]]</button>
						{{{ if privileges.columnCountGroupOther }}}
						<button type="button" data-filter="other" class="btn btn-outline-secondary btn-sm">[[admin/manage/categories:privileges.section-other]]</button>
						{{{ end }}}
					</div>
				</th>
			</tr><tr><!-- zebrastripe reset --></tr>
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
				<td>
					<div class="dropdown">
						<button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="true">
							<i class="fa fa-copy"></i>
						</button>
						<ul class="dropdown-menu" role="menu">
							<li data-action="copyToAllGroup"><a class="dropdown-item" href="#" role="menuitem">[[admin/manage/categories:privileges.copy-group-privileges-to-all-categories]]</a></li>
							<li data-action="copyToChildrenGroup"><a class="dropdown-item" href="#" role="menuitem">[[admin/manage/categories:privileges.copy-group-privileges-to-children]]</a></li>
							<li data-action="copyPrivilegesFromGroup"><a class="dropdown-item" href="#" role="menuitem">[[admin/manage/categories:privileges.copy-group-privileges-from]]</a></li>
						</ul>
					</div>
				</td>
				<td class="">
					<div class="form-check text-center">
						<input autocomplete="off" type="checkbox" class="form-check-input float-none checkbox-helper">
					</div>
				</td>
				{function.spawnPrivilegeStates, cid, privileges.groups.name, ../privileges, ../types}
			</tr>
			{{{ end }}}
		</tbody>
		<tfoot>
			<tr>
				<td colspan="3"></td>
				<td colspan="{privileges.keys.groups.length}">
					<div class="btn-toolbar justify-content-end gap-1 flex-nowrap">
						<button type="button" class="btn btn-sm btn-outline-secondary text-nowrap" data-ajaxify="false" data-action="search.group">
							<i class="fa fa-users"></i>
							[[admin/manage/categories:privileges.search-group]]
						</button>
						<button type="button" class="btn btn-sm btn-outline-secondary text-nowrap" data-ajaxify="false" data-action="copyPrivilegesFrom">
							<i class="fa fa-copy"></i>
							[[admin/manage/categories:privileges.copy-from-category]]
						</button>
						<button type="button" class="btn btn-sm btn-outline-secondary text-nowrap" data-ajaxify="false" data-action="copyToChildren">
							<i class="fa fa-copy"></i>
							[[admin/manage/categories:privileges.copy-to-children]]
						</button>
						<button type="button" class="btn btn-sm btn-outline-secondary text-nowrap" data-ajaxify="false" data-action="copyToAll">
							<i class="fa fa-copy"></i>
							[[admin/manage/categories:privileges.copy-privileges-to-all-categories]]
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
				<td class="">
					<div class="form-check text-center">
						<input autocomplete="off" type="checkbox" class="form-check-input float-none checkbox-helper">
					</div>
				</td>
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

					<label>[[admin/manage/privileges:group-privileges]]</label>
					<table class="table table-striped privilege-table">
						<thead>
							<tr class="privilege-table-header">
								<th colspan="3"></th>
								<th class="arrowed" colspan="3">
									[[admin/manage/categories:privileges.section-viewing]]
								</th>
								<th class="arrowed" colspan="9">
									[[admin/manage/categories:privileges.section-posting]]
								</th>
								<th class="arrowed" colspan="3">
									[[admin/manage/categories:privileges.section-moderation]]
								</th>
								<!-- IF privileges.columnCountGroupOther -->
								<th class="arrowed" colspan="{privileges.columnCountGroupOther}">
									[[admin/manage/categories:privileges.section-other]]
								</th>
								<!-- END -->
							</tr><tr><!-- zebrastripe reset --></tr>
							<tr>
								<th colspan="2">[[admin/manage/categories:privileges.section-group]]</th>
								<th class="text-center">[[admin/manage/privileges:select-clear-all]]</th>
								<!-- BEGIN privileges.labels.groups -->
								<th class="text-center">{privileges.labels.groups.name}</th>
								<!-- END privileges.labels.groups -->
							</tr>
						</thead>
						<tbody>
							<!-- BEGIN privileges.groups -->
							<tr data-group-name="{privileges.groups.nameEscaped}" data-private="<!-- IF privileges.groups.isPrivate -->1<!-- ELSE -->0<!-- ENDIF privileges.groups.isPrivate -->">
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
										<button class="btn btn-default btn-sm dropdown-toggle" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="true">
											<i class="fa fa-copy"></i>
										</button>
										<ul class="dropdown-menu" aria-labelledby="dropdownMenu1">
											<li data-action="copyToAllGroup"><a href="#">[[admin/manage/categories:privileges.copy-group-privileges-to-all-categories]]</a></li>
											<li data-action="copyToChildrenGroup"><a href="#">[[admin/manage/categories:privileges.copy-group-privileges-to-children]]</a></li>
											<li data-action="copyPrivilegesFromGroup"><a href="#">[[admin/manage/categories:privileges.copy-group-privileges-from]]</a></li>
										</ul>
									</div>
								</td>
								<td class="text-center"><input autocomplete="off" type="checkbox" class="checkbox-helper"></td>
								{function.spawnPrivilegeStates, privileges.groups.name, ../privileges}
							</tr>
							<!-- END privileges.groups -->
						</tbody>
						<tfoot>
							<tr>
								<td colspan="3"></td>
								<td colspan="{privileges.keys.groups.length}">
									<div class="btn-toolbar">
										<button type="button" class="btn btn-default pull-right" data-ajaxify="false" data-action="search.group">
											<i class="fa fa-users"></i>
											[[admin/manage/categories:privileges.search-group]]
										</button>
										<button type="button" class="btn btn-default pull-right" data-ajaxify="false" data-action="copyPrivilegesFrom">
											<i class="fa fa-copy"></i>
											[[admin/manage/categories:privileges.copy-from-category]]
										</button>
										<button type="button" class="btn btn-default pull-right" data-ajaxify="false" data-action="copyToChildren">
											<i class="fa fa-copy"></i>
											[[admin/manage/categories:privileges.copy-to-children]]
										</button>
										<button type="button" class="btn btn-default pull-right" data-ajaxify="false" data-action="copyToAll">
											<i class="fa fa-copy"></i>
											[[admin/manage/categories:privileges.copy-privileges-to-all-categories]]
										</button>
									</div>
								</td>
							</tr>
						</tfoot>
					</table>
					<div class="help-block">
						[[admin/manage/categories:privileges.inherit]]
					</div>
					<hr/>
					<label>[[admin/manage/privileges:user-privileges]]</label>
					<table class="table table-striped privilege-table">
						<thead>
							<tr class="privilege-table-header">
								<th colspan="3"></th>
								<th class="arrowed" colspan="3">
									[[admin/manage/categories:privileges.section-viewing]]
								</th>
								<th class="arrowed" colspan="9">
									[[admin/manage/categories:privileges.section-posting]]
								</th>
								<th class="arrowed" colspan="3">
									[[admin/manage/categories:privileges.section-moderation]]
								</th>
								<!-- IF privileges.columnCountUserOther -->
								<th class="arrowed" colspan="{privileges.columnCountUserOther}">
									[[admin/manage/categories:privileges.section-other]]
								</th>
								<!-- END -->
							</tr><tr><!-- zebrastripe reset --></tr>
							<tr>
								<th colspan="2">[[admin/manage/categories:privileges.section-user]]</th>
								<th class="text-center">[[admin/manage/privileges:select-clear-all]]</th>
								<!-- BEGIN privileges.labels.users -->
								<th class="text-center">{privileges.labels.users.name}</th>
								<!-- END privileges.labels.users -->
							</tr>
						</thead>
						<tbody>
							<!-- BEGIN privileges.users -->
							<tr data-uid="{privileges.users.uid}"{{{ if privileges.users.banned }}} data-banned{{{ end }}}>
								<td>
									<!-- IF ../picture -->
									<img class="avatar avatar-sm" src="{privileges.users.picture}" title="{privileges.users.username}" />
									<!-- ELSE -->
									<div class="avatar avatar-sm" style="background-color: {../icon:bgColor};">{../icon:text}</div>
									<!-- ENDIF ../picture -->
								</td>
								<td>
									{{{ if privileges.users.banned }}}
									<i class="ban fa fa-gavel text-danger" title="[[admin/manage/categories:privileges.banned-user-inheritance]]"></i>
									{{{ end }}}
									{privileges.users.username}
								</td>
								<td class="text-center"><input autocomplete="off" type="checkbox" class="checkbox-helper"></td>
								{function.spawnPrivilegeStates, privileges.users.username, ../privileges}
							</tr>
							<!-- END privileges.users -->
						</tbody>
						<tfoot>
							<tr>
								<td colspan="3"></td>
								<td colspan="{privileges.keys.users.length}">
									<button type="button" class="btn btn-default pull-right" data-ajaxify="false" data-action="search.user">
										<i class="fa fa-user"></i>
										[[admin/manage/categories:privileges.search-user]]
									</button>
								</td>
							</tr>
						</tfoot>
					</table>

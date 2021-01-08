					<label>[[admin/manage/privileges:group-privileges]]</label>
					<table class="table table-striped privilege-table">
						<thead>
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
									<!-- IF privileges.groups.isPrivate -->
									<i class="fa fa-lock text-muted" title="[[admin/manage/categories:privileges.group-private]]"></i>
									<!-- ENDIF privileges.groups.isPrivate -->
									{privileges.groups.name}
								</td>
								<td></td>
								<td class="text-center"><input autocomplete="off" type="checkbox" class="checkbox-helper"></td>
								{function.spawnPrivilegeStates, privileges.groups.name, ../privileges}
							</tr>
							<!-- END privileges.groups -->
							<tr>
								<td colspan="{privileges.columnCount}">
									<div class="btn-toolbar">
										<button type="button" class="btn btn-default pull-right" data-ajaxify="false" data-action="search.group">
											<i class="fa fa-users"></i>
											[[admin/manage/categories:privileges.search-group]]
										</button>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
					<div class="help-block">
						[[admin/manage/categories:privileges.inherit]]
					</div>
					<hr/>
					<label>[[admin/manage/privileges:user-privileges]]</label>
					<table class="table table-striped privilege-table">
						<thead>
							<tr class="privilege-table-header">
								<th colspan="15"></th>
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
							<tr data-uid="{privileges.users.uid}">
								<td>
									<!-- IF ../picture -->
									<img class="avatar avatar-sm" src="{privileges.users.picture}" title="{privileges.users.username}" />
									<!-- ELSE -->
									<div class="avatar avatar-sm" style="background-color: {../icon:bgColor};">{../icon:text}</div>
									<!-- ENDIF ../picture -->
								</td>
								<td>{privileges.users.username}</td>
								<td class="text-center"><input autocomplete="off" type="checkbox" class="checkbox-helper"></td>
								{function.spawnPrivilegeStates, privileges.users.username, ../privileges}
							</tr>
							<!-- END privileges.users -->
							<tr>
								<td colspan="{privileges.columnCount}">
									<button type="button" class="btn btn-default pull-right" data-ajaxify="false" data-action="search.user">
										<i class="fa fa-user"></i>
										[[admin/manage/categories:privileges.search-user]]
									</button>
								</td>
							</tr>
						</tbody>
					</table>

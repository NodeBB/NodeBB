					<table class="table table-striped privilege-table">
						<thead>
							<tr class="privilege-table-header">
								<th colspan="2"></th>
								<th class="arrowed" colspan="3">
									[[admin/manage/categories:privileges.section-viewing]]
								</th>
								<th class="arrowed" colspan="9">
									[[admin/manage/categories:privileges.section-posting]]
								</th>
								<th class="arrowed" colspan="3">
									[[admin/manage/categories:privileges.section-moderation]]
								</th>
							</tr><tr><!-- zebrastripe reset --></tr>
							<tr>
								<th colspan="2">[[admin/manage/categories:privileges.section-user]]</th>
								<!-- BEGIN privileges.labels.users -->
								<th class="text-center">{privileges.labels.users.name}</th>
								<!-- END privileges.labels.users -->
							</tr>
						</thead>
						<tbody>
							<!-- IF privileges.users.length -->
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
								{function.spawnPrivilegeStates, privileges.users.username, ../privileges}
							</tr>
							<!-- END privileges.users -->
							<tr>
								<td colspan="{privileges.columnCount}">
									<button type="button" class="btn btn-primary pull-right" data-ajaxify="false" data-action="search.user">
										[[admin/manage/categories:privileges.search-user]]
									</button>
								</td>
							</tr>
							<!-- ELSE -->
							<tr>
								<td colspan="{privileges.columnCount}">
									[[admin/manage/categories:privileges.no-users]]
									<button type="button" class="btn btn-primary pull-right" data-ajaxify="false" data-action="search.user">
										[[admin/manage/categories:privileges.search-user]]
									</button>
								</td>
							</tr>
							<!-- ENDIF privileges.users.length -->
						</tbody>
					</table>

					<table class="table table-striped privilege-table">
						<thead>
							<tr class="privilege-table-header">
								<th colspan="2"></th>
								<th class="arrowed" colspan="3">
									[[admin/manage/categories:privileges.section-viewing]]
								</th>
								<th class="arrowed" colspan="9">
									[[admin/manage/categories:privileges.section-posting]]
								</th>
								<th class="arrowed" colspan="3">
									[[admin/manage/categories:privileges.section-moderation]]
								</th>
							</tr><tr><!-- zebrastripe reset --></tr>
							<tr>
								<th colspan="2">[[admin/manage/categories:privileges.section-group]]</th>
								<!-- BEGIN privileges.labels.groups -->
								<th class="text-center">{privileges.labels.groups.name}</th>
								<!-- END privileges.labels.groups -->
							</tr>
						</thead>
						<tbody>
							<!-- BEGIN privileges.groups -->
							<tr data-group-name="{privileges.groups.name}" data-private="<!-- IF privileges.groups.isPrivate -->1<!-- ELSE -->0<!-- ENDIF privileges.groups.isPrivate -->">
								<td>
									<!-- IF privileges.groups.isPrivate -->
									<i class="fa fa-lock text-muted" title="[[admin/manage/categories:privileges.group-private]]"></i>
									<!-- ENDIF privileges.groups.isPrivate -->
									{privileges.groups.name}
								</td>
								<td></td>
								{function.spawnPrivilegeStates, privileges.groups.name, ../privileges}
							</tr>
							<!-- END privileges.groups -->
							<tr>
								<td colspan="{privileges.columnCount}">
									<div class="btn-toolbar">
										<button type="button" class="btn btn-primary pull-right" data-ajaxify="false" data-action="search.group">
											[[admin/manage/categories:privileges.search-group]]
										</button>
										<button type="button" class="btn btn-info pull-right" data-ajaxify="false" data-action="copyToChildren">
											[[admin/manage/categories:privileges.copy-to-children]]
										</button>
										<button type="button" class="btn btn-info pull-right" data-ajaxify="false" data-action="copyPrivilegesFrom">
											[[admin/manage/categories:privileges.copy-from-category]]
										</button>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
					<div class="help-block">
						[[admin/manage/categories:privileges.inherit]]
					</div>

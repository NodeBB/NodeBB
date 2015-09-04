					<table class="table table-striped table-hover privilege-table">
						<tr>
							<th colspan="2">[[admin:privileges.user]]</th>
							<!-- BEGIN privileges.labels.users -->
							<th class="text-center">{privileges.labels.users.name}</th>
							<!-- END privileges.labels.users -->
						</tr>
						<!-- IF privileges.users.length -->
						<!-- BEGIN privileges.users -->
						<tr data-uid="{privileges.users.uid}">
							<td><img src="{privileges.users.picture}" title="{privileges.users.username}" /></td>
							<td>{privileges.users.username}</td>
							{function.spawnPrivilegeStates, privileges.users.username, privileges}
						</tr>
						<!-- END privileges.users -->
						<tr>
							<td colspan="{privileges.columnCount}">
								<button type="button" class="btn btn-primary pull-right" data-ajaxify="false" data-action="search.user">[[admin:privileges.add_user]]</button>
							</td>
						</tr>
						<!-- ELSE -->
						<tr>
							<td colspan="{privileges.columnCount}">
								<button type="button" class="btn btn-primary pull-right" data-ajaxify="false" data-action="search.user">[[admin:privileges.add_user]]</button>
								[[admin:privileges.no_user_specific_privileges]]
							</td>
						</tr>
						<!-- ENDIF privileges.users.length -->
					</table>

					<table class="table table-striped table-hover privilege-table">
						<tr>
							<th colspan="2">[[admin:privileges.group]]</th>
							<!-- BEGIN privileges.labels.groups -->
							<th class="text-center">{privileges.labels.groups.name}</th>
							<!-- END privileges.labels.groups -->
						</tr>
						<!-- IF privileges.groups.length -->
						<!-- BEGIN privileges.groups -->
						<tr data-group-name="{privileges.groups.name}" data-private="<!-- IF privileges.groups.isPrivate -->1<!-- ELSE -->0<!-- ENDIF privileges.groups.isPrivate -->">
							<td>
								<!-- IF privileges.groups.isPrivate -->
								<i class="fa fa-lock text-muted" title="[[admin:privileges.group_is_private]]"></i>
								<!-- ENDIF privileges.groups.isPrivate -->
								{privileges.groups.name}
							</td>
							<td></td>
							{function.spawnPrivilegeStates, name, privileges}
						</tr>
						<!-- END privileges.groups -->
						<tr>
							<td colspan="{privileges.columnCount}">
								<button type="button" class="btn btn-primary pull-right" data-ajaxify="false" data-action="search.group">[[admin:privileges.add_group]]</button>
							</td>
						</tr>
						<!-- ELSE -->
						<tr>
							<td colspan="{privileges.columnCount}">
								<button type="button" class="btn btn-primary pull-right" data-ajaxify="false" data-action="search.group">[[admin:privileges.add_group]]</button>
								[[admin:privileges.no_group_specific_privileges]]
							</td>
						</tr>
						<!-- ENDIF privileges.groups.length -->
					</table>
					<div class="help-block">[[admin:privileges.help]]
					</div>

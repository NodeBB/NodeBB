					<div class="privilege-table-container">
						<table class="table table-striped table-hover privilege-table">
							<tr>
								<th colspan="2">User</th>
								<!-- BEGIN privileges.labels.users -->
								<th class="text-center">{privileges.labels.users.name}</th>
								<!-- END privileges.labels.users -->
							</tr>
							<!-- IF privileges.users.length -->
							<!-- BEGIN privileges.users -->
							<tr data-uid="{uid}">
								<td><img src="{picture}" title="{username}" /></td>
								<td>{username}</td>
								{function.spawnPrivilegeStates, privileges}
							</tr>
							<!-- END privileges.users -->
							<!-- ELSE -->
							<tr>
								<td colspan="{privileges.columnCount}">
									<div class="alert alert-info">No user-specific privileges in this category.</div>
								</td>
							</tr>
							<!-- ENDIF privileges.users.length -->
						</table>

						<table class="table table-striped table-hover privilege-table">
							<tr>
								<th colspan="1">Group</th>
								<!-- BEGIN privileges.labels.groups -->
								<th class="text-center">{privileges.labels.groups.name}</th>
								<!-- END privileges.labels.groups -->
							</tr>
							<!-- BEGIN privileges.groups -->
							<tr data-group-slug="{privileges.groups.slug}">
								<td>{privileges.groups.name}</td>
								{function.spawnPrivilegeStates, privileges}
							</tr>
							<!-- END privileges.groups -->
						</table>
					</div>
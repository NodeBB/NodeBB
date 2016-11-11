<div class="row manage-users">
	<div class="col-lg-12">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-user"></i> Users</div>
			<div class="panel-body">

				<div class="clearfix">
					<div class="btn-group pull-right">
						<button class="btn btn-default dropdown-toggle" data-toggle="dropdown" type="button">Edit <span class="caret"></span></button>
						<ul class="dropdown-menu">
							<li><a href="#" class="admin-user"><i class="fa fa-fw fa-shield"></i> Make Admin</a></li>
							<li><a href="#" class="remove-admin-user"><i class="fa fa-fw fa-ban"></i> Remove Admin</a></li>
							<li class="divider"></li>
							<li><a href="#" class="validate-email"><i class="fa fa-fw fa-check"></i> Validate Email</a></li>
							<li><a href="#" class="send-validation-email"><i class="fa fa-fw fa-mail-forward"></i> Send Validation Email</a></li>
							<li><a href="#" class="password-reset-email"><i class="fa fa-fw fa-key"></i> Send Password Reset Email</a></li>
							<li class="divider"></li>
							<li><a href="#" class="ban-user"><i class="fa fa-fw fa-gavel"></i> Ban User(s)</a></li>
							<li><a href="#" class="ban-user-temporary"><i class="fa fa-fw fa-clock-o"></i> Ban User(s) Temporarily</a></li>
							<li><a href="#" class="unban-user"><i class="fa fa-fw fa-comment-o"></i> Unban User(s)</a></li>
							<li><a href="#" class="reset-lockout"><i class="fa fa-fw fa-unlock"></i> Reset Lockout</a></li>
							<li><a href="#" class="reset-flags"><i class="fa fa-fw fa-flag"></i> Reset Flags</a></li>
							<li class="divider"></li>
							<li><a href="#" class="delete-user"><i class="fa fa-fw fa-trash-o"></i> Delete User(s)</a></li>
							<li><a href="#" class="delete-user-and-content"><i class="fa fa-fw fa-trash-o"></i> Delete User(s) and Content</a></li>
						</ul>
					</div>

					<a target="_blank" href="{config.relative_path}/api/admin/users/csv" class="btn btn-primary pull-right">Download CSV</a>

					<!-- IF inviteOnly -->
					<!-- IF loggedIn -->
					<button component="user/invite" class="btn btn-success form-control"><i class="fa fa-users"></i> Invite</button>
					<!-- ENDIF loggedIn -->
					<!-- ENDIF inviteOnly -->

					<button id="createUser" class="btn btn-primary pull-right">New User</button>
				</div>

				<ul class="nav nav-pills">
					<li><a href='{config.relative_path}/admin/manage/users/latest'>Latest Users</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/not-validated'>Not validated</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/no-posts'>No Posts</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/top-posters'>Top Posters</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/most-reputation'>Most Reputation</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/inactive'>Inactive</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/flagged'>Most Flags</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/banned'>Banned</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/search'>User Search</a></li>
				</ul>

				<br />

				<div class="search {search_display}">
					<label>By User Name</label>
					<input class="form-control" id="search-user-name" data-search-type="username" type="text" placeholder="Enter a username to search"/><br />

					<label>By Email </label>
					<input class="form-control" id="search-user-email" data-search-type="email" type="text" placeholder="Enter a email to search"/><br />

					<label>By IP Address </label>
					<input class="form-control" id="search-user-ip" data-search-type="ip" type="text" placeholder="Enter an IP Address to search"/><br />

					<i class="fa fa-spinner fa-spin hidden"></i>
					<span id="user-notfound-notify" class="label label-danger hide">User not found!</span><br/>
				</div>

				<!-- IF inactive -->
				<a href="{config.relative_path}/admin/manage/users/inactive?months=3" class="btn btn-default">3 months</a>
				<a href="{config.relative_path}/admin/manage/users/inactive?months=6" class="btn btn-default">6 months</a>
				<a href="{config.relative_path}/admin/manage/users/inactive?months=12" class="btn btn-default">12 months</a>
				<!-- ENDIF inactive -->

				<div class="table-responsive">
					<table class="table table-striped users-table">
						<tr>
							<th><input component="user/select/all" type="checkbox"/></th>
							<th>uid</th>
							<th>username</th>
							<th>email</th>
							<th class="text-right">postcount</th>
							<th class="text-right">reputation</th>
							<th class="text-right">flags</th>
							<th>joined</th>
							<th>last online</th>
							<th>banned</th>
						</tr>
						<!-- BEGIN users -->
						<tr class="user-row">
							<th><input component="user/select/single" data-uid="{users.uid}" type="checkbox"/></th>
							<td class="text-right">{users.uid}</td>
							<td><i class="administrator fa fa-shield text-success<!-- IF !users.administrator --> hidden<!-- ENDIF !users.administrator -->"></i><a href="{config.relative_path}/user/{users.userslug}"> {users.username}</a></td>
	
							<td>
							<!-- IF config.requireEmailConfirmation -->
							<i class="validated fa fa-check text-success<!-- IF !users.email:confirmed --> hidden<!-- ENDIF !users.email:confirmed -->" title="validated"></i>
							<i class="notvalidated fa fa-times text-danger<!-- IF users.email:confirmed --> hidden<!-- ENDIF users.email:confirmed -->" title="not validated"></i>
							<!-- ENDIF config.requireEmailConfirmation --> {users.email}</td>
							<td class="text-right">{users.postcount}</td>
							<td class="text-right">{users.reputation}</td>
							<td class="text-right"><!-- IF users.flags -->{users.flags}<!-- ELSE -->0<!-- ENDIF users.flags --></td>
							<td><span class="timeago" title="{users.joindateISO}"></span></td>
							<td><span class="timeago" title="{users.lastonlineISO}"></span></td>
							<td class="text-center"><i class="ban fa fa-gavel text-danger<!-- IF !users.banned --> hidden<!-- ENDIF !users.banned -->"></i></td>
						</tr>
						<!-- END users -->
					</table>
				</div>

				<!-- IMPORT partials/paginator.tpl -->
			</div>
		</div>
	</div>
</div>

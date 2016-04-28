<div class="manage-users">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-user"></i> Users</div>
			<div class="panel-body">
				<ul class="nav nav-pills">
					<li><a href='{config.relative_path}/admin/manage/users/latest'>Latest Users</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/not-validated'>Not validated</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/no-posts'>No Posts</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/inactive'>Inactive</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/banned'>Banned</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/search'>User Search</a></li>


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
							<li><a href="#" class="ban-user"><i class="fa fa-fw fa-gavel"></i> Ban User</a></li>
							<li><a href="#" class="unban-user"><i class="fa fa-fw fa-comment-o"></i> Unban User</a></li>
							<li><a href="#" class="reset-lockout"><i class="fa fa-fw fa-unlock"></i> Reset Lockout</a></li>
							<li><a href="#" class="reset-flags"><i class="fa fa-fw fa-flag"></i> Reset Flags</a></li>
							<li class="divider"></li>
							<li><a href="#" class="delete-user"><i class="fa fa-fw fa-trash-o"></i> Delete User</a></li>
						</ul>
					</div>
				</ul>

				<br />

				<div class="search {search_display} well">
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


				<ul id="users-container">
					<!-- BEGIN users -->
					<div class="users-box" data-uid="{users.uid}" data-username="{users.username}">
						<div class="user-image">
							<!-- IF users.picture -->
							<img src="{users.picture}" class="img-thumbnail user-selectable"/>
							<!-- ELSE -->
							<div class="user-icon user-selectable" style="background-color: {users.icon:bgColor};">{users.icon:text}</div>
							<!-- ENDIF users.picture -->
							<div class="labels">
								<!-- IF config.requireEmailConfirmation -->
								<!-- IF !users.email:confirmed -->
								<span class="notvalidated label label-danger">Not Validated</span>
								<!-- ENDIF !users.email:confirmed -->
								<!-- ENDIF config.requireEmailConfirmation -->
								<span class="administrator label label-primary <!-- IF !users.administrator -->hide<!-- ENDIF !users.administrator -->">Admin</span>
								<span class="ban label label-danger <!-- IF !users.banned -->hide<!-- ENDIF !users.banned -->">Banned</span>
							</div>
						</div>

						<a href="{config.relative_path}/user/{users.userslug}" target="_blank">{users.username} ({users.uid})</a><br/>
						<!-- IF users.email -->
						<small><span title="{users.email}">{users.email}</span></small>
						<!-- ENDIF users.email -->

						joined <span class="timeago" title="{users.joindateISO}"></span><br/>
						login <span class="timeago" title="{users.lastonlineISO}"></span><br/>
						posts {users.postcount}

						<!-- IF users.flags -->
						<div><small><span><i class="fa fa-flag"></i> {users.flags}</span></small></div>
						<!-- ENDIF users.flags -->
					</div>
					<!-- END users -->
				</ul>

				<!-- IMPORT partials/paginator.tpl -->

				<div class="modal fade" id="create-modal">
					<div class="modal-dialog">
						<div class="modal-content">
							<div class="modal-header">
								<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
								<h4 class="modal-title">Create User</h4>
							</div>
							<div class="modal-body">
								<div class="alert alert-danger hide" id="create-modal-error"></div>
								<form>
									<div class="form-group">
										<label for="group-name">User Name</label>
										<input type="text" class="form-control" id="create-user-name" placeholder="User Name" />
									</div>
									<div class="form-group">
										<label for="group-name">Email</label>
										<input type="text" class="form-control" id="create-user-email" placeholder="Email of this user" />
									</div>

									<div class="form-group">
										<label for="group-name">Password</label>
										<input type="password" class="form-control" id="create-user-password" placeholder="Password" />
									</div>

									<div class="form-group">
										<label for="group-name">Password Confirm</label>
										<input type="password" class="form-control" id="create-user-password-again" placeholder="Password" />
									</div>

								</form>
							</div>
							<div class="modal-footer">
								<button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
								<button type="button" class="btn btn-primary" id="create-modal-go">Create</button>
							</div>
						</div>
					</div>
				</div>

			</div>
		</div>
	</div>

	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">Users Control Panel</div>
			<div class="panel-body">
				<button id="createUser" class="btn btn-primary form-control">New User</button>
				<a target="_blank" href="{config.relative_path}/api/admin/users/csv" class="btn btn-primary form-control">Download CSV</a>

				<!-- IF inviteOnly -->
				<!-- IF loggedIn -->
				<button component="user/invite" class="btn btn-success form-control"><i class="fa fa-users"></i> Invite</button>
				<!-- ENDIF loggedIn -->
				<!-- ENDIF inviteOnly -->

			</div>
		</div>
	</div>
</div>

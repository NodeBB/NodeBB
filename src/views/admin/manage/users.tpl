<div class="users">
	<div class="col-sm-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-user"></i> Users</div>
			<div class="panel-body">			
				<ul class="nav nav-pills">
					<li class='active'><a href='{relative_path}/admin/manage/users/search'>Search</a></li>
					<li class=''><a href='{relative_path}/admin/manage/users/latest'>Latest Users</a></li>
					<li class=''><a href='{relative_path}/admin/manage/users/sort-posts'>Top Posters</a></li>
					<li class=''><a href='{relative_path}/admin/manage/users/sort-reputation'>Most Reputation</a></li>


					<div class="btn-group pull-right">
						<button class="btn btn-default dropdown-toggle" data-toggle="dropdown" type="button">Edit <span class="caret"></span></button>
						<ul class="dropdown-menu">
							<li><a href="#" class="admin-user"><i class="fa fa-fw fa-shield"></i> Make Admin</a></li>
							<li><a href="#" class="remove-admin-user"><i class="fa fa-fw fa-ban"></i> Remove Admin</a></li>
							<li class="divider"></li>
							<li><a href="#" class="ban-user"><i class="fa fa-fw fa-gavel"></i> Ban User</a></li>
							<li><a href="#" class="unban-user"><i class="fa fa-fw fa-comment-o"></i> Unban User</a></li>
							<li><a href="#" class="reset-lockout"><i class="fa fa-fw fa-unlock"></i> Reset Lockout</a></li>
							<li class="divider"></li>
							<li><a href="#" class="delete-user"><i class="fa fa-fw fa-trash-o"></i> Delete User</a></li>
						</ul>
					</div>
				</ul>

				<br />

				<div class="search {search_display} well">
					<input class="form-control" id="search-user" type="text" placeholder="Enter a username to search"/><br />
					<i class="fa fa-spinner fa-spin hidden"></i>
					<span id="user-notfound-notify" class="label label-danger hide">User not found!</span><br/>
				</div>


				<ul id="users-container" class="users">
					<!-- BEGIN users -->
					<div class="users-box" data-uid="{users.uid}" data-username="{users.username}">

						<a href="{relative_path}/user/{users.userslug}" target="_blank"><img src="{users.picture}" class="img-thumbnail"/></a>
						<br/>

						<i class="fa fa-fw fa-square-o select pointer"></i>
						<a href="{relative_path}/user/{users.userslug}" target="_blank">{users.username}</a>
						<br/>

						<div title="uid">
							<i class='fa fa-user'></i>
							<span>{users.uid}</span>
						</div>

						<span class="administrator label label-primary <!-- IF !users.administrator -->hide<!-- ENDIF !users.administrator -->">Admin</span>

						<br/>

						<span class="ban label label-danger <!-- IF !users.banned -->hide<!-- ENDIF !users.banned -->">Banned</span>

					</div>
					<!-- END users -->
				</ul>

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



				<div class="text-center {loadmore_display}">
					<button id="load-more-users-btn" class="btn btn-primary">Load More</button>
				</div>
				<input type="hidden" template-variable="yourid" value="{yourid}" />
				
			</div>
		</div>
	</div>

	<div class="col-lg-3">
		<div class="panel panel-default">
			<div class="panel-heading">Users Control Panel</div>
			<div class="panel-body">
				<button id="createUser" class="btn btn-primary">New User</button>
				<a target="_blank" href="/admin/users/csv" class="btn btn-primary">Download CSV</a>
			</div>
		</div>
	</div>
</div>
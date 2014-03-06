<h1><i class="fa fa-user"></i> Users</h1>

<button id="createUser" class="btn btn-primary">Create User</button>
<a target="_blank" href="/admin/users/csv" class="btn btn-primary">Download CSV</a>
<hr />
<ul class="nav nav-pills">
	<li class='active'><a href='{relative_path}/admin/users/latest'>Latest Users</a></li>
	<li class=''><a href='{relative_path}/admin/users/sort-posts'>Top Posters</a></li>
	<li class=''><a href='{relative_path}/admin/users/sort-reputation'>Most Reputation</a></li>
	<li class=''><a href='{relative_path}/admin/users/search'>Search</a></li>
</ul>

<br />
<div class="search {search_display} well">
	<input class="form-control" id="search-user" type="text" placeholder="Enter a username to search"/><br />
	<i class="fa fa-spinner fa-spin none"></i>
	<span id="user-notfound-notify" class="label label-danger hide">User not found!</span><br/>
</div>

<ul id="users-container" class="users admin">
	<!-- BEGIN users -->
	<div class="users-box" data-uid="{users.uid}" data-admin="{users.administrator}" data-username="{users.username}" data-banned="{users.banned}">
		<a href="{relative_path}/user/{users.userslug}"><img src="{users.picture}" class="img-thumbnail"/></a>
		<br/>
		<a href="{relative_path}/user/{users.userslug}">{users.username}</a>
		<br/>
		<div title="reputation">
			<i class='fa fa-star'></i>
			<span id='reputation'>{users.reputation}</span>
		</div>
		<div title="post count">
			<i class='fa fa-pencil'></i>
			<span id='postcount'>{users.postcount}</span>
		</div>
		<div>
			<a href="#" class="btn btn-default admin-btn">Make Admin</a>
		</div>
		<div>
			<a href="#" class="btn btn-default ban-btn">Ban</a>
		</div>
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

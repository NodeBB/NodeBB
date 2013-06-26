<h1>Users</h1>
<hr />
<ul class="nav nav-pills">
	<li class='active'><a href='/admin/users/latest'>Latest Users</a></li>
	<li class=''><a href='/admin/users/sort-posts'>Top Posters</a></li>
	<li class=''><a href='/admin/users/sort-reputation'>Most Reputation</a></li>
	<li class=''><a href='/admin/users/search'>Search</a></li>
</ul>


<div class="search {search_display} well">
	<input id="search-user" type="text" placeholder="Enter a username to search"/><br />
	<i class="icon-spinner icon-spin none"></i>
</div>

<!-- BEGIN users -->
<div class="users-box well" data-uid="{users.uid}" data-admin="{users.administrator}" data-username="{users.username}">
	<a href="/users/{users.userslug}">
		<img src="{users.picture}" class="user-8080-picture"/>
	</a>
	<br/>
	<a href="/users/{users.userslug}">{users.username}</a>
	<br/>
	<div title="reputation">
		<span id='reputation'>{users.reputation}</span>
		<i class='icon-star'></i>
	</div>
	<div title="post count">
		<span id='postcount'>{users.postcount}</span>
		<i class='icon-pencil'></i>
	</div>
	<div>
		<a href="#" class="btn admin-btn">Admin</a>
	</div>
	<br/>
	<div>
		<a href="#" class="btn delete-btn btn-danger">Delete</a>
	</div>
</div>
<!-- END users -->

<input type="hidden" template-variable="yourid" value="{yourid}" />


<script type="text/javascript" src="../../src/forum/admin/users.js"></script>
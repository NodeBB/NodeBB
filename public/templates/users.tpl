<div>
	
	<ul class="nav nav-pills">
		<li class='active'><a href='/users-latest'>Latest Users</a></li>
		<li class=''><a href='/users-sort-posts'>Top Posters</a></li>
		<li class=''><a href='/users-sort-reputation'>Most Reputation</a></li>
		<li class=''><a href='/users-search'>Search</a></li>
	</ul>


	<div class="search {search_display} well">
		<input id="search-user" type="text" placeholder="Enter a username to search"/><br />
		<i class="icon-spinner icon-spin none"></i>
		<span id="user-notfound-notify" class="label label-important hide">User not found!</span><br/>
	</div>
	
	<ul class="users">
		<!-- BEGIN users -->
		<div class="users-box">
			<a href="/users/{users.userslug}">
				<img src="{users.picture}" class="img-polaroid"/>
			</a>
			<br/>
			<a href="/users/{users.userslug}">{users.username}</a>
			<br/>
			<div title="reputation">
				<span class='reputation'>{users.reputation}</span>
				<i class='icon-star'></i>
			</div>
			<div title="post count">
				<span class='postcount'>{users.postcount}</span>
				<i class='icon-pencil'></i>
			</div>
		</div>
		<!-- END users -->
	</ul>
</div>

<script type="text/javascript" src="/src/forum/users.js"></script>
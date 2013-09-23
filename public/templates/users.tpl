<div class="users">
	<ul class="nav nav-pills">
		<li class=''><a href='/users/latest'>Latest Users</a></li>
		<li class=''><a href='/users/sort-posts'>Top Posters</a></li>
		<li class=''><a href='/users/sort-reputation'>Most Reputation</a></li>
		<li class=''><a href='/users/online'>Online</a></li>
		<li class=''><a href='/users/search'>Search</a></li>
	</ul>

	<br />
	<div class="search {search_display} well">

		<div class="input-group">
			<input class="form-control" id="search-user" type="text" placeholder="Enter a username to search"/>
	        <span class="input-group-addon">
	        	<span id="user-notfound-notify"><i class="icon icon-circle-blank"></i></span>
	        </span>
		</div>
	</div>

	<ul id="users-container" class="users-container">
		<!-- BEGIN users -->
		<div class="users-box">
			<a href="/user/{users.userslug}">
				<img src="{users.picture}" class="img-thumbnail"/>
			</a>
			<br/>
			<div class="user-info">
				<a href="/user/{users.userslug}">{users.username}</a>
				<br/>
				<div title="reputation" class="reputation">
					<span class='formatted-number'>{users.reputation}</span>
					<i class='icon-star'></i>
				</div>
				<div title="post count" class="post-count">
					<span class='formatted-number'>{users.postcount}</span>
					<i class='icon-pencil'></i>
				</div>
			</div>
		</div>
		<!-- END users -->
	</ul>

	<div class="text-center {loadmore_display}">
		<button id="load-more-users-btn" class="btn btn-primary">Load More</button>
	</div>
</div>

<script type="text/javascript" src="{relative_path}/src/forum/users.js"></script>
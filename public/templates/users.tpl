<h1>Users</h1>
<div>
	<!-- BEGIN users -->
	<div class="users-box well">
		<a href="/users/{users.username}">
			<img src="{users.picture}" class="user-8080-picture"/>
		</a>
		<br/>
		<a href="/users/{users.username}">{users.username}</a>
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
</div>

<script type="text/javascript" src="/src/forum/users.js"></script>
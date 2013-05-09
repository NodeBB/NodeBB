<h1>Users</h1>
<hr />
<ul class="nav nav-pills">
	<li class='active'><a href='/admin/users'>Latest Users</a></li>
	<li class=''><a href='/admin/users/sort-posts'>Top Posters</a></li>
	<li class=''><a href='/admin/users/sort-reputation'>Most Reputation</a></li>
	<li class=''><a href='/admin/users/search'>Search</a></li>
</ul>


<div class="search {search_display} well">
	<input type="text" placeholder="Enter a username to search" onkeypress="jQuery('.icon-spinner').removeClass('none');" /><br />
	<i class="icon-spinner icon-spin none"></i>
</div>

<!-- BEGIN users -->
<div class="users-box well">
 	<a href="/users/{users.username}">
	    <img src="{users.picture}"/>
    </a>
    <br/>
	<a href="/users/{users.username}">{users.username}</a>
    <br/>
	<div title="reputation">
		<span id='reputation'>{users.reputation}</span>
		<i class='icon-star'></i>
	</div>
	<div title="post count">
		<span id='postcount'>{users.postcount}</span>
		<i class='icon-pencil'></i>
	</div>

</div>
<!-- END users -->


<script type="text/javascript">
//DRY Failure. this needs to go into an ajaxify onready style fn. Currently is copy pasted into every single function so after ACP is off the ground fix asap 
(function() {
	jQuery('document').ready(function() {
		var url = window.location.href,
			parts = url.split('/'),
			active = parts[parts.length-1];

		jQuery('.nav-pills li').removeClass('active');
		jQuery('.nav-pills li a').each(function() {
			if (this.getAttribute('href').match(active)) {
				jQuery(this.parentNode).addClass('active');
				return false;
			}
		})
	});
	
}());
</script>
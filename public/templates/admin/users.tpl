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
<div class="users-box well" data-uid="{users.uid}">
	<a href="/users/{users.username}">
		<img src="{users.picture}" class="user-8080-picture"/>
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
	<div>
		<a href="#" class="btn admin-btn" data-admin="{users.administrator}" data-username="{users.username}">Admin</a>
	</div>

</div>
<!-- END users -->

<input type="hidden" template-variable="yourid" value="{yourid}" />


<script type="text/javascript">
//DRY Failure. this needs to go into an ajaxify onready style fn. Currently is copy pasted into every single function so after ACP is off the ground fix asap 
(function() {
	jQuery('document').ready(function() {

		var yourid = templates.get('yourid');

		var url = window.location.href,
			parts = url.split('/'),
			active = parts[parts.length-1];

		jQuery('.nav-pills li').removeClass('active');
		jQuery('.nav-pills li a').each(function() {
			if (this.getAttribute('href').match(active)) {
				jQuery(this.parentNode).addClass('active');
				return false;
			}
		});

		jQuery('.admin-btn').each(function(index, element) {
			var adminBtn = $(element);
			var isAdmin = adminBtn.attr('data-admin') !== "0";
			
			if(isAdmin)
				adminBtn.addClass('btn-success');
			else
				adminBtn.removeClass('btn-success');

		});

		jQuery('.admin-btn').on('click', function() {
			var adminBtn = $(this);
			var isAdmin = adminBtn.attr('data-admin') !== "0";
			var parent = adminBtn.parents('.users-box');

			var uid = parent.attr('data-uid');

			if(isAdmin) {
				socket.emit('api:admin.user.removeAdmin', uid);		
				adminBtn.removeClass('btn-success');
				adminBtn.attr('data-admin', 0);
			}
			else {
				bootbox.confirm('Do you really want to make "' + adminBtn.attr('data-username') +'" an admin?', function(confirm) {
					if(confirm) {
						socket.emit('api:admin.user.makeAdmin', uid);
						adminBtn.addClass('btn-success');
						adminBtn.attr('data-admin', 1);
					}
				});
			}
			
			return false;
		});
	
	});
	
}());
</script>
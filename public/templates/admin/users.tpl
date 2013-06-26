<h1>Users</h1>
<hr />
<ul class="nav nav-pills">
	<li class='active'><a href='/admin/users/latest'>Latest Users</a></li>
	<li class=''><a href='/admin/users/sort-posts'>Top Posters</a></li>
	<li class=''><a href='/admin/users/sort-reputation'>Most Reputation</a></li>
	<li class=''><a href='/admin/users/search'>Search</a></li>
</ul>


<div class="search {search_display} well">
	<input type="text" placeholder="Enter a username to search" onkeypress="jQuery('.icon-spinner').removeClass('none');" /><br />
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

		function isUserAdmin(element) {
			var parent = $(element).parents('.users-box');
			return (parent.attr('data-admin') !== "0");
		}

		function getUID(element) {
			var parent = $(element).parents('.users-box');
			return parent.attr('data-uid');	
		}

		jQuery('.admin-btn').each(function(index, element) {
			var adminBtn = $(element);
			var isAdmin = isUserAdmin(adminBtn);
			
			if(isAdmin)
				adminBtn.addClass('btn-success');
			else
				adminBtn.removeClass('btn-success');

		});

		jQuery('.delete-btn').each(function(index, element) {
			var deleteBtn = $(element);
			var isAdmin = isUserAdmin(deleteBtn);
			
			if(isAdmin)
				deleteBtn.addClass('disabled');
			else
				deleteBtn.show();
		});

		jQuery('.admin-btn').on('click', function() {
			var adminBtn = $(this);
			var isAdmin = isUserAdmin(adminBtn);
			var parent = adminBtn.parents('.users-box');
			var uid = getUID(adminBtn);

			if(isAdmin) {
				socket.emit('api:admin.user.removeAdmin', uid);		
				adminBtn.removeClass('btn-success');
				parent.find('.delete-btn').removeClass('disabled');
				parent.attr('data-admin', 0);
			}
			else {
				bootbox.confirm('Do you really want to make "' + parent.attr('data-username') +'" an admin?', function(confirm) {
					if(confirm) {
						socket.emit('api:admin.user.makeAdmin', uid);
						adminBtn.addClass('btn-success');
						parent.find('.delete-btn').addClass('disabled');
						parent.attr('data-admin', 1);
					}
				});
			}
			
			return false;
		});

		jQuery('.delete-btn').on('click', function() {
			var deleteBtn = $(this);
			var isAdmin = isUserAdmin(deleteBtn);
			var parent = deleteBtn.parents('.users-box');
			var uid = getUID(deleteBtn);

			if(!isAdmin) {
				bootbox.confirm('Do you really want to delete "' + parent.attr('data-username') +'"?', function(confirm) {
					socket.emit('api:admin.user.deleteUser', uid);		
				});
			}
			
			return false;
		});
	
	});
	
}());
</script>
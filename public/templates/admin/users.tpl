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
		<a href="#" class="btn make-admin-btn" data-admin="{users.administrator}">Make Admin</a>
	</div>
	<div>
		<a href="#" class="btn remove-admin-btn" data-admin="{users.administrator}">Remove Admin</a>
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

		jQuery('.make-admin-btn').each(function(index, element) {
			var adminBtn = $(element);
			var isAdmin = adminBtn.attr('data-admin') !== "0";
			
			if(isAdmin)
				adminBtn.hide();				
			else
				adminBtn.show();

		});

		jQuery('.remove-admin-btn').each(function(index, element) {
			var adminBtn = $(element);
			var isAdmin = adminBtn.attr('data-admin') !== "0";
			var parent = adminBtn.parents('.users-box');
			var uid = parent.attr('data-uid');
			console.log(uid);
			console.log(yourid);
			if(isAdmin && uid != yourid)
				adminBtn.show();				
			else
				adminBtn.hide();

		});

		jQuery('.make-admin-btn').on('click', function() {
			var makeBtn = $(this);
			var parent = makeBtn.parents('.users-box');
			var removeBtn = parent.find('.remove-admin-btn');
			var uid = parent.attr('data-uid');

			var userData = {
				uid:uid
			};
			
			$.post('/admin/makeadmin',
				userData,
				function(data) {
					app.alert({
					  'alert_id': 'user_made_admin',
					  type: 'success',
					  title: 'User Modified',
					  message: 'This user is an administrator now!',
					  timeout: 2000
					});

					makeBtn.hide();
					removeBtn.show();
				}
			);

			return false;
		});

		jQuery('.remove-admin-btn').on('click', function() {
			
			var removeBtn = $(this);
			var parent = removeBtn.parents('.users-box');
			var makeBtn = parent.find('.make-admin-btn');
			var uid = parent.attr('data-uid');

			var userData = {
				uid:uid
			};
			
			$.post('/admin/removeadmin',
				userData,
				function(data) {
					app.alert({
					  'alert_id': 'user_removed_admin',
					  type: 'success',
					  title: 'User Modified',
					  message: 'This user is no longer an administrator!',
					  timeout: 2000
					});

					makeBtn.show();
					removeBtn.hide();
				}
			);

			
			return false;
		});


	});
	
}());
</script>
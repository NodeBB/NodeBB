
<div class="hero-unit">
	<h1>Welcome to NodeBB</h1>
	<br />
	<p>
		<a target="_blank" href="http://www.nodebb.org" class="btn btn-large"><i class="icon-comment"></i> NodeBB Forum</a>
		<a target="_blank" href="http://www.nodebb.org" class="btn btn-large"><i class="icon-github-alt"></i> Get Plugins</a>
		<a target="_blank" href="http://www.nodebb.org" class="btn btn-large"><i class="icon-github-alt"></i> Get Themes</a>
		<a target="_blank" href="http://www.nodebb.org" class="btn btn-large"><i class="icon-twitter"></i> dcplabs</a>
	</p>
	<p><small>You are running <strong>NodeBB v0.0.1</strong>. This is where we will check to make sure your <strong>NodeBB</strong> is latest, etc.</small></p>
</div>


<div class="">
	<h2>Active Users <small><span class="badge" id="connections"></span> socket connections</small></h2>
	<p id="active_users">

	</p>
</div>

<script type="text/javascript">

	
	ajaxify.register_events(['api:get_all_rooms']);
	socket.on('api:get_all_rooms', function(data) {
		var active_users = document.getElementById('active_users'),
			total = 0;
			active_users.innerHTML = '';
	
		for(var room in data) {
			if (room !== '') {
				var count = data[room].length;
				total += count;
				active_users.innerHTML = active_users.innerHTML + "<div class='alert alert-success'><strong>" + room + "</strong> " + count + " active user" + (count > 1 ? "s" : "") + "</div>"; 
			}
		}

		document.getElementById('connections').innerHTML = total;
	});

	app.enter_room('admin');
	socket.emit('api:get_all_rooms');

	socket.on('api:admin.user.search', function(data) {
		console.log('move this into user.js but it should execute only once');
		var	html = templates.prepare(templates['admin/users'].blocks['users']).parse({
				users: data
			}),
			userListEl = document.querySelector('.users');

		userListEl.innerHTML = html;
		jQuery('.icon-spinner').addClass('none');				

		if(data && data.length === 0) {
			$('#user-notfound-notify').html('User not found!')
				.show()
				.addClass('label-important')
				.removeClass('label-success');
		}
		else {
			$('#user-notfound-notify').html(data.length + ' user'+(data.length>1?'s':'') + ' found!')
				.show()
				.addClass('label-success')
				.removeClass('label-important');
		}
		
		user.initUsers();
	});

</script>
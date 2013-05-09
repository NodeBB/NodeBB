
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

		for(var room in data) {
			if (room !== '') {
				var count = data[room].length;
				total += count;
				active_users.innerHTML = active_users.innerHTML + "<div class='alert alert-success'><strong>" + room + "</strong> " + count + " active user" + (count > 1 ? "s" : "") + "</div><br />"; 
			}
		}

		document.getElementById('connections').innerHTML = total;
	});

	socket.emit('api:get_all_rooms');
</script>


	</div><!--END container -->
	<!-- START Forum Info -->
	<div id="footer" class="container" style="padding-top: 50px; display: none">
		<div class="alert alert-info">
			<span id="active_users"></span>; <span id="active_record"></span><br />
			<span id="number_of_users"></span><br />
			<span id="latest_user"></span>
		</div>
		<footer class="footer">Copyright &copy; 2013 <a target="_blank" href="http://www.nodebb.com">NodeBB</a> by <a target="_blank" href="https://github.com/psychobunny">psychobunny</a>, <a href="https://github.com/julianlam" target="_blank">julianlam</a>, <a href="https://github.com/barisusakli" target="_blank">barisusakli</a> from <a target="_blank" href="http://www.designcreateplay.com">designcreateplay</a></footer>
	</div>

	<script type="text/javascript">
	(function() {
		var num_users = document.getElementById('number_of_users'),
			latest_user = document.getElementById('latest_user'),
			active_users = document.getElementById('active_users'),
			user_label = document.getElementById('user_label'),
			active_record = document.getElementById('active_record'),
			right_menu = document.getElementById('right-menu');

		socket.emit('user.count', {});
		socket.on('user.count', function(data) {
			num_users.innerHTML = "We currently have <b>" + data.count + "</b> registered users.";
		});
		socket.emit('user.latest', {});
		socket.on('user.latest', function(data) {
			if (data.username == '') {
				latest_user.innerHTML = '';
			} else {
				latest_user.innerHTML = "The most recent user to register is <b>" + data.username + "</b>.";
			}
		});
		socket.emit('api:user.active.get');
		socket.on('api:user.active.get', function(data) {
			var plural_users = parseInt(data.users) !== 1,
				plural_anon = parseInt(data.anon) !== 1;

			active_users.innerHTML = 'There ' + (plural_users ? 'are' : 'is') + ' <strong>' + data.users + '</strong> user' + (plural_users ? 's' : '') + ' and <strong>' + data.anon + '</strong> guest' + (plural_anon ? 's' : '') + ' online';
		});
		socket.emit('api:user.active.get_record');
		socket.on('api:user.active.get_record', function(data) {
			active_record.innerHTML = "most users ever online was <strong>" + data.record + "</strong> on <strong>" + (new Date(parseInt(data.timestamp,10))).toUTCString() + "</strong>";
		});

		socket.emit('api:updateHeader', { fields: ['username', 'picture'] });

		socket.once('api:updateHeader', function(data) {
			
			if (data.uid > 0) {
				var	gravatar = document.createElement('img'),
					name = document.createElement('span')
					logoutEl = document.createElement('li');

				logoutEl.innerHTML = '<a href="/logout">Log out</a>';

				name.innerHTML = data['username'];
				gravatar.src = data['picture']+"?s=24";


                $('#user_label').attr('href','/users/'+data.uid);

				user_label.innerHTML = '';
				user_label.appendChild(gravatar);
				user_label.appendChild(name);
				right_menu.appendChild(logoutEl);
			} else {
				var registerEl = document.createElement('li'),
					loginEl = document.createElement('li');

				registerEl.innerHTML = '<a href="/register">Register</a>';
				loginEl.innerHTML = '<a href="/login">Login</a>';

				right_menu.appendChild(registerEl);
				right_menu.appendChild(loginEl);
			}
		});
	}());
	</script>
	<!-- END Forum Info -->
</body>
</html>
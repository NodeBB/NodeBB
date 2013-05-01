

	</div><!--END container -->
	<!-- START Forum Info -->
	<div id="footer" class="container" style="padding-top: 50px;">
		<div class="alert alert-info">
			<span id="active_users"></span><br />
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
			user_label = document.getElementById('user_label');

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
			active_users.innerHTML = 'There ' + (parseInt(data.users) !== 1 ? 'are' : 'is') + ' <strong>' + data.users + '</strong> user' + (parseInt(data.users) !== 1 ? 's' : '') + ' and <strong>' + data.anon + '</strong> guest' + (parseInt(data.anon) !== 1 ? 's' : '') + ' online';
		});
		socket.emit('api:user.get', { fields: ['username', 'picture'] });
		socket.on('api:user.get', function(data) {
			var	gravatar = document.createElement('img'),
				name = document.createElement('span');

			name.innerHTML = data['username'];
			gravatar.src = data['picture'];

			user_label.appendChild(gravatar);
			user_label.appendChild(name);
		});
	}());
	</script>
	<!-- END Forum Info -->
</body>
</html>


	</div><!--END container -->
	<!-- START Forum Info -->
	<div id="footer" class="container" style="padding-top: 50px;">
		<div class="alert alert-info">
			<span id="number_of_users"></span><br />
			<span id="latest_user"></span>
		</div>
		<footer class="footer">Copyright &copy; 2013 <a target="_blank" href="http://www.nodebb.com">NodeBB</a> by <a target="_blank" href="https://github.com/psychobunny">psychobunny</a>, <a href="https://github.com/julianlam" target="_blank">julianlam</a>, <a href="https://github.com/barisusakli" target="_blank">barisusakli</a> from <a target="_blank" href="http://www.designcreateplay.com">designcreateplay</a></footer>
	</div>

	<script type="text/javascript">
	(function() {
		var num_users = document.getElementById('number_of_users'),
			latest_user = document.getElementById('latest_user');
		socket.emit('user.count', {});
		socket.on('user.count', function(data) {
			num_users.innerHTML = "We currently have <b>" + data.count + "</b> registered users.";
		});
		socket.emit('user.latest', {});
		socket.on('user.latest', function(data) {
			latest_user.innerHTML = "The most recent user to register is <b>" + data.username + "</b>.";
		});
	}());
	</script>
	<!-- END Forum Info -->
</body>
</html>
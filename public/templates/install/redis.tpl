
<h1>Step 1 &ndash; Establish Redis Connection</h1>

<p class="lead">
	Thanks for choosing to install NodeBB! We&apos;ll need some information to set up your installation
	configuration...
</p>
<p>
	Please enter the details of your Redis server here. If redis is hosted on the same
	server as NodeBB, you can leave the default values as-is.
</p>

<form class="form-horizontal">
	<div class="control-group">
		<label class="control-label" for="redis-hostname">Hostname</label>
		<div class="controls">
			<input type="text" id="redis-hostname" class="input-medium" placeholder="127.0.0.1" value="127.0.0.1" />
		</div>
	</div>
	<div class="control-group">
		<label class="control-label" for="redis-port">Port</label>
		<div class="controls">
			<input type="number" id="redis-port" class="input-mini" placeholder="6379" value="6379" />
		</div>
	</div>
	<div class="control-group">
		<div class="controls">
			<button class="btn" id="test-redis">Test</button>
		</div>
	</div>
</form>

<hr />
<div class="pull-right">
	<button data-path="basic" class="btn btn-primary btn-large" disabled>Next &ndash; <i class="icon-cog"></i> Basic</button>
</div>

<script>
	(function() {
		var	testRedisEl = document.getElementById('test-redis');
		testRedisEl.addEventListener('click', function(e) {
			e.preventDefault();

			if (e.target.className.indexOf('testing') === -1) {
				e.target.className += ' testing';
				e.target.innerHTML = '<i class="icon-spinner icon-spin"></i> Testing';
				socket.once('api:config.redisTest', function(data) {
					if (data && data.status === 'ok') {
						e.target.className = 'btn btn-success testing';
						e.target.innerHTML = 'Redis Connection Successful!';

						app.alert({
							type: 'success',
							timeout: 10000,
							alert_id: 'config-ready',
							title: 'Setup Ready!',
							message:	'NodeBB is ready to continue with the setup process. ' +
										'Any changes you make now will be saved automatically'
						});

						// Grab configs from the db and enable the 'next' button
						socket.emit('api:config.setup', {
							'redis/host': document.getElementById('redis-hostname').value,
							'redis/port': document.getElementById('redis-port').value
						});
					} else {
						e.target.className = 'btn btn-danger';
						e.target.innerHTML = 'Could not connect to Redis, click here to test again';
					}
				});
				socket.emit('api:config.redisTest');
			}
		});

		var nextBtn = document.querySelector('button[data-path="basic"]');
		socket.once('api:config.setup', function(data) {
			nodebb_setup.config = data;
			nextBtn.disabled = false;
		});
	})();
</script>

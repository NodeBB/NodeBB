<h1>Logger</h1>
<hr />

<h3>Logger Settings</h3>
<div class="alert alert-warning">

    <p>
		By enabling the check boxes, you will receive logs to standard output. If you specify a path, logs will then be saved to a file instead. HTTP logging is useful for collecting statistics about who and when people access your forum. Socket.io logging, in combination with redis-cli monitor, can be very helpful for learning NodeBB's internals.
    </p>
	<br/>

	<form>

		<label>
			<input type="checkbox" data-field="loggerStatus"> <strong>Enable HTTP logging</strong>
		</label>
		<br/>
		<br/>

		<label>Path to log file</label>
		<input class="form-control" type="text" placeholder="/path/to/log/file.log" data-field="loggerPath" />
		<br />
		<br/>
		<br/>

		<label>
			<input type="checkbox" data-field="loggerIOStatus"> <strong>Enable socket.io event logging</strong>
		</label>
		<br/>
		<br/>

		<label>Path to socket.io log file</label>
        <input class="form-control" type="text" placeholder="/path/to/log/socket.io.file.log" data-field="loggerIOPath" />

		<br/>
		<br/>
		
	</form>
</div>

<button class="btn btn-lg btn-primary" id="save">Save</button>

<script>
	var	loadDelay = setInterval(function() {
		if (nodebb_admin) {
			nodebb_admin.prepare();
			clearInterval(loadDelay);
		}
	}, 500);
</script>

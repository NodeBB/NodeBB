<h1><i class="fa fa-th"></i> Logger</h1>
<hr />

<h3>Logger Settings</h3>
<div class="alert alert-warning">

    <p>
		By enabling the check boxes, you will receive logs to your terminal. If you specify a path, logs will then be saved to a file instead. HTTP logging is useful for collecting statistics about who, when, and what people access on your forum. In addition to logging HTTP requests, we can also log socket.io events. Socket.io logging, in combination with redis-cli monitor, can be very helpful for learning NodeBB's internals.
    </p>
	<br/>
	<p>
		Simply check/uncheck the logging settings to enable or disable logging on the fly. No restart needed.
	</p>
	<br/>

	<form>

		<label>
			<input type="checkbox" data-field="loggerStatus"> <strong>Enable HTTP logging</strong>
		</label>
		<br/>
		<br/>

		<label>
			<input type="checkbox" data-field="loggerIOStatus"> <strong>Enable socket.io event logging</strong>
		</label>
		<br/>
		<br/>


		<label>Path to log file</label>
		<input class="form-control" type="text" placeholder="/path/to/log/file.log ::: leave blank to log to your terminal" data-field="loggerPath" />
		<br />
		<br/>
		<br/>

	</form>
</div>

<button class="btn btn-primary" id="save">Save</button>

<script>
	require(['forum/admin/settings'], function(Settings) {
		Settings.prepare();
	});
</script>

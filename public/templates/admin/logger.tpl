<h1>Logger</h1>
<hr />

<h3>Logger Settings</h3>
<div class="alert alert-warning">

    <p>
		By enabling the check box, you will receive http logs to standard output. If you specify a path, logs will then be saved to a file instead.
    </p>
	<br/>

	<form>

		<label>
			<input type="checkbox" data-field="loggerStatus"> <strong>Enable logging</strong>
		</label>
		<br/>

		<label>Path to log file</label>
		<input class="form-control" type="text" placeholder="/path/to/log/file.log" data-field="loggerPath" /><br />
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

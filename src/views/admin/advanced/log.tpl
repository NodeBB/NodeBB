<div class="logs">
	<div class="col-sm-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-file-text-o"></i> Logs</div>
			<div class="panel-body">
				<pre>{data}</pre>
			</div>
		</div>
	</div>
</div>

<div class="col-lg-3">
	<div class="panel panel-default">
		<div class="panel-body">
			<button class="btn btn-primary btn-md" id="clearLog">Clear Log</button>
		</div>
	</div>
</div>

<script>
$('#clearLog').on('click', function() {
	socket.emit('admin.clearLog', {}, function(err) {
		if (err) {
			return app.alertError(err.message);
		}

		$('.logs .panel-body pre').text('');
	});
})
</script

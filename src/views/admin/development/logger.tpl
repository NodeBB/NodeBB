<div class="logger">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin:logger.logger_settings]]</div>
			<div class="panel-body">
				<p>
					[[admin:logger.logger_settings_help1]]
				</p>
				<br/>
				<p>
					[[admin:logger.logger_settings_help2]]
				</p>
				<br/>

				<form>

					<label>
						<input type="checkbox" data-field="loggerStatus"> <strong>[[admin:logger.enable_http_logging]]</strong>
					</label>
					<br/>
					<br/>

					<label>
						<input type="checkbox" data-field="loggerIOStatus"> <strong>[[admin:logger.enable_event_logging]]</strong>
					</label>
					<br/>
					<br/>

					<label>[[admin:logger.path_to_log_file]]</label>
					<input class="form-control" type="text" placeholder="[[admin:logger.path_to_log_file_placeholder]]" data-field="loggerPath" />
				</form>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">[[admin:logger.heap_snapshot]]</div>
			<div class="panel-body">
				<button class="btn btn-primary" id="heap-snapshot">[[admin:logger.take_heap_snapshot]]</button>
			</div>
		</div>
	</div>

	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin:logger.logger_control_panel]]</div>
			<div class="panel-body">
				<button class="btn btn-primary" id="save">[[admin:logger.update_logger_settings]]</button>
			</div>
		</div>
	</div>
</div>


<script>
	require(['admin/settings'], function(Settings) {
		Settings.prepare();

		$('#heap-snapshot').on('click', function() {
			socket.emit('admin.takeHeapSnapshot', function(err, filename) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('[[admin:logger.heap_snapshot_saved]]' + filename);
			});
		})
	});
</script>

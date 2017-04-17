<div class="row logger">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin/development/logger:logger-settings]]</div>
			<div class="panel-body">
				<p>
					[[admin/development/logger:description]]
				</p>
				<br/>
				<p>
					[[admin/development/logger:explanation]]
				</p>
				<br/>

				<form>

					<label>
						<input type="checkbox" data-field="loggerStatus"> <strong>[[admin/development/logger:enable-http]]</strong>
					</label>
					<br/>
					<br/>

					<label>
						<input type="checkbox" data-field="loggerIOStatus"> <strong>[[admin/development/logger:enable-socket]]</strong>
					</label>
					<br/>
					<br/>

					<label>[[admin/development/logger:file-path]]</label>
					<input class="form-control" type="text" placeholder="[[admin/development/logger:file-path-placeholder]]" data-field="loggerPath" />
				</form>
			</div>
		</div>

	</div>

	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin/development/logger:control-panel]]</div>
			<div class="panel-body">
				<button class="btn btn-primary" id="save">[[admin/development/logger:update-settings]]</button>
			</div>
		</div>
	</div>
</div>


<script>
	require(['admin/settings'], function(Settings) {
		Settings.prepare();
	});
</script>

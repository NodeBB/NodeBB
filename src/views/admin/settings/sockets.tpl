<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
	<div class="panel-heading">Web Socket Settings</div>
	<div class="panel-body">
		<form>
			<div class="form-group">
				<label for="maxReconnectionAttempts">Max Reconnection Attempts</label>
				<input class="form-control" id="maxReconnectionAttempts" type="text" value="5" data-field="maxReconnectionAttempts" />
			</div>
			<div class="form-group">
				<label for="reconnectionDelay">Reconnection Delay</label>
				<input class="form-control" id="reconnectionDelay" type="text" value="200" data-field="reconnectionDelay" />
			</div>
			<div class="form-group">
				<label for="websocketAddress">Websocket Address</label>
				<input class="form-control" id="websocketAddress" type="text" data-field="websocketAddress" />
				<p class="help-block">
					Leave blank if unsure.
				</p>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
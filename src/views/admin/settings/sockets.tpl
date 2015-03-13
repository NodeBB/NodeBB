<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
	<div class="panel-heading">Web Socket Settings</div>
	<div class="panel-body">
		<form>
			<div class="form-group">
				<label for="maxReconnectionAttempts">Max Reconnection Attempts</label>
				<input class="form-control" id="maxReconnectionAttempts" type="text" value="5" placeholder="Default: 5" data-field="maxReconnectionAttempts" />
			</div>
			<div class="form-group">
				<label for="reconnectionDelay">Reconnection Delay</label>
				<input class="form-control" id="reconnectionDelay" type="text" value="1500" placeholder="Default: 1500" data-field="reconnectionDelay" />
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
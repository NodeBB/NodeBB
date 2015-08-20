<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-xs-2 settings-header">Reconnection Settings</div>
	<div class="col-xs-10">
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
<div class="sounds settings" class="row">
	<div class="col-xs-9">
		<form role="form">
			<div class="row">
				<div class="col-sm-2 col-xs-12 settings-header">Notifications</div>
				<div class="col-sm-10 col-xs-12">
					<label for="notification">Notifications</label>
					<div class="row">
						<div class="form-group col-xs-9">
							<select class="form-control" id="notification" name="notification">
								<option value=""></option>
								<!-- BEGIN sounds -->
								<option value="{sounds.name}">{sounds.name}</option>
								<!-- END sounds -->
							</select>
						</div>
						<div class="btn-group col-xs-3">
							<button type="button" class="form-control btn btn-sm btn-default" data-action="play">Play <i class="fa fa-play"></i></button>
						</div>
					</div>
				</div>
			</div>

			<div class="row">
				<div class="col-sm-2 col-xs-12 settings-header">Chat Messages</div>
				<div class="col-sm-10 col-xs-12">
					<label for="chat-incoming">Incoming Message</label>
					<div class="row">
						<div class="form-group col-xs-9">
							<select class="form-control" id="chat-incoming" name="chat-incoming">
								<option value=""></option>
								<!-- BEGIN sounds -->
								<option value="{sounds.name}">{sounds.name}</option>
								<!-- END sounds -->
							</select>
						</div>
						<div class="btn-group col-xs-3">
							<button type="button" class="form-control btn btn-sm btn-default" data-action="play">Play <i class="fa fa-play"></i></button>
						</div>
					</div>

					<label for="chat-outgoing">Outgoing Message</label>
					<div class="row">
						<div class="form-group col-xs-9">
							<select class="form-control" id="chat-outgoing" name="chat-outgoing">
								<option value=""></option>
								<!-- BEGIN sounds -->
								<option value="{sounds.name}">{sounds.name}</option>
								<!-- END sounds -->
							</select>
						</div>
						<div class="btn-group col-xs-3">
							<button type="button" class="form-control btn btn-sm btn-default" data-action="play">Play <i class="fa fa-play"></i></button>
						</div>
					</div>
				</div>
			</div>
		</form>
	</div>

	<div class="col-xs-3">
		<div class="panel">
			<div class="panel-body">
				<div class="input-group">
					<span class="input-group-btn">
						<input data-action="upload" data-title="Upload Sound" data-route="{config.relative_path}/api/admin/upload/sound" type="button" class="btn btn-primary btn-block" value="Upload New Sound"></input>
					</span>
				</div>
			</div>
		</div>
	</div>
</div>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">save</i>
</button>

<script>
	require(['admin/settings'], function(Settings) {
		Settings.init();
	});
</script>
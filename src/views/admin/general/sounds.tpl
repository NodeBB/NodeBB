<div class="sounds settings row">
	<div class="col-xs-12">
		<form role="form">
			<div class="row">
				<div class="col-sm-2 col-xs-12 settings-header">[[admin/general/sounds:notifications]]</div>
				<div class="col-sm-10 col-xs-12">
					<label for="notification">[[admin/general/sounds:notifications]]</label>
					<div class="row">
						<div class="form-group col-xs-9">
							<select class="form-control" id="notification" data-field="notification">
								<option value="">[[user:no-sound]]</option>
								<!-- BEGIN notification-sound -->
								<optgroup label="{notification-sound.name}">
									<!-- BEGIN notification-sound.sounds -->
									<option value="{notification-sound.sounds.value}" <!-- IF notification-sound.sounds.selected -->selected<!-- ENDIF notification-sound.sounds.selected -->>
										{notification-sound.sounds.name}
									</option>
									<!-- END notification-sound.sounds -->
								</optgroup>
								<!-- END notification-sound -->
							</select>
						</div>
						<div class="btn-group col-xs-3">
							<button type="button" class="form-control btn btn-sm btn-default" data-action="play"><span class="hidden-xs">[[admin/general/sounds:play-sound]] </span><i class="fa fa-play"></i></button>
						</div>
					</div>
				</div>
			</div>

			<div class="row">
				<div class="col-sm-2 col-xs-12 settings-header">[[admin/general/sounds:chat-messages]]</div>
				<div class="col-sm-10 col-xs-12">
					<label for="chat-incoming">[[admin/general/sounds:incoming-message]]</label>
					<div class="row">
						<div class="form-group col-xs-9">
							<select class="form-control" id="chat-incoming" data-field="chat-incoming">
								<option value="">[[user:no-sound]]</option>
								<!-- BEGIN chat-incoming-sound -->
								<optgroup label="{chat-incoming-sound.name}">
									<!-- BEGIN chat-incoming-sound.sounds -->
									<option value="{chat-incoming-sound.sounds.value}" <!-- IF chat-incoming-sound.sounds.selected -->selected<!-- ENDIF chat-incoming-sound.sounds.selected -->>
										{chat-incoming-sound.sounds.name}
									</option>
									<!-- END chat-incoming-sound.sounds -->
								</optgroup>
								<!-- END chat-incoming-sound -->
							</select>
						</div>
						<div class="btn-group col-xs-3">
							<button type="button" class="form-control btn btn-sm btn-default" data-action="play"><span class="hidden-xs">[[admin/general/sounds:play-sound]] </span><i class="fa fa-play"></i></button>
						</div>
					</div>

					<label for="chat-outgoing">[[admin/general/sounds:outgoing-message]]</label>
					<div class="row">
						<div class="form-group col-xs-9">
							<select class="form-control" id="chat-outgoing" data-field="chat-outgoing">
								<option value="">[[user:no-sound]]</option>
								<!-- BEGIN chat-outgoing-sound -->
								<optgroup label="{chat-outgoing-sound.name}">
									<!-- BEGIN chat-outgoing-sound.sounds -->
									<option value="{chat-outgoing-sound.sounds.value}" <!-- IF chat-outgoing-sound.sounds.selected -->selected<!-- ENDIF chat-outgoing-sound.sounds.selected -->>
										{chat-outgoing-sound.sounds.name}
									</option>
									<!-- END chat-outgoing-sound.sounds -->
								</optgroup>
								<!-- END chat-outgoing-sound -->
							</select>
						</div>
						<div class="btn-group col-xs-3">
							<button type="button" class="form-control btn btn-sm btn-default" data-action="play"><span class="hidden-xs">[[admin/general/sounds:play-sound]] </span><i class="fa fa-play"></i></button>
						</div>
					</div>

					<div class="input-group">
						<span class="input-group-btn">
							<input
								data-action="upload"
								data-title="Upload Sound"
								data-route="{config.relative_path}/api/admin/upload/sound"
								data-accept="audio/*"
								type="button"
								class="btn btn-primary"
								value="[[admin/general/sounds:upload-new-sound]]"
							></input>
						</span>
					</div>
				</div>
			</div>
		</form>
	</div>

</div>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">save</i>
</button>
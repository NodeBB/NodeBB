<!-- IMPORT admin/partials/settings/header.tpl -->


<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/chat:chat-settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<div class="form-group">
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" id="disableChat" data-field="disableChat">
					<span class="mdl-switch__label"><strong>[[admin/settings/chat:disable]]</strong></span>
				</label>
			</div>
		</div>

		<div class="form-group">
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" id="disableChatMessageEditing" data-field="disableChatMessageEditing">
					<span class="mdl-switch__label"><strong>[[admin/settings/chat:disable-editing]]</strong></span>
				</label>
			</div>
			<p class="help-block">[[admin/settings/chat:disable-editing-help]]</p>
		</div>

		<div class="form-group">
			<label>[[admin/settings/chat:restrictions.seconds-edit-after]]</label>
			<input type="text" class="form-control" value="0" data-field="chatEditDuration">
		</div>

		<div class="form-group">
			<label>[[admin/settings/chat:restrictions.seconds-delete-after]]</label>
			<input type="text" class="form-control" value="0" data-field="chatDeleteDuration">
		</div>

		<div class="form-group">
			<label>[[admin/settings/chat:max-length]]</label>
			<input type="text" class="form-control" value="1000" data-field="maximumChatMessageLength">
		</div>

		<div class="form-group">
			<label>[[admin/settings/chat:max-room-size]]</label>
			<input type="text" class="form-control" value="0" data-field="maximumUsersInChatRoom">
		</div>


		<div class="form-group">
			<label>[[admin/settings/chat:delay]]</label>
			<input type="text" class="form-control" value="200" data-field="chatMessageDelay">
		</div>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
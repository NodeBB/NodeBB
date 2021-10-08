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
			<label for="chatEditDuration">[[admin/settings/chat:restrictions.seconds-edit-after]]</label>
			<input id="chatEditDuration" type="text" class="form-control" value="0" data-field="chatEditDuration">
		</div>

		<div class="form-group">
			<label for="chatDeleteDuration">[[admin/settings/chat:restrictions.seconds-delete-after]]</label>
			<input id="chatDeleteDuration" type="text" class="form-control" value="0" data-field="chatDeleteDuration">
		</div>

		<div class="form-group">
			<label for="maximumChatMessageLength">[[admin/settings/chat:max-length]]</label>
			<input id="maximumChatMessageLength" type="text" class="form-control" value="1000" data-field="maximumChatMessageLength">
		</div>

		<div class="form-group">
			<label for="maximumUsersInChatRoom">[[admin/settings/chat:max-room-size]]</label>
			<input id="maximumUsersInChatRoom" type="text" class="form-control" value="0" data-field="maximumUsersInChatRoom">
		</div>


		<div class="form-group">
			<label for="chatMessageDelay">[[admin/settings/chat:delay]]</label>
			<input id="chatMessageDelay" type="text" class="form-control" value="200" data-field="chatMessageDelay">
		</div>

		<div class="form-group">
			<label for="notificationSendDelay">[[admin/settings/chat:notification-delay]]</label>
			<input id="notificationSendDelay" type="text" class="form-control" value="60" data-field="notificationSendDelay">
		</div>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
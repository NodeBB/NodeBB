<!-- IMPORT admin/settings/header.tpl -->


<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Chat Settings</div>
	<div class="col-sm-10 col-xs-12">
		<div class="form-group">
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" id="disableChat" data-field="disableChat">
					<span class="mdl-switch__label"><strong>Disable chat</strong></span>
				</label>
			</div>
		</div>

		<div class="form-group">
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" id="disableChatMessageEditing" data-field="disableChatMessageEditing">
					<span class="mdl-switch__label"><strong>Disable chat message editing/deletion</strong></span>
				</label>
			</div>
			<p class="help-block">Administrators and global moderators are exempt from this restriction</p>
		</div>

		<div class="form-group">
			<label>Maximum length of chat messages</label>
			<input type="text" class="form-control" value="1000" data-field="maximumChatMessageLength">
		</div>

		<div class="form-group">
			<label>Maximum number of users in chat rooms</label>
			<input type="text" class="form-control" value="0" data-field="maximumUsersInChatRoom">
		</div>


		<div class="form-group">
			<label>Time between chat messages in milliseconds</label>
			<input type="text" class="form-control" value="200" data-field="chatMessageDelay">
		</div>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
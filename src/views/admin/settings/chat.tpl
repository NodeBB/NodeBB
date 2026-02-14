<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="chat-settings" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header hidden">[[admin/settings/chat:chat-settings]]</h5>

				<div class="mb-3">
					<div class="form-check form-switch">
						<input type="checkbox" class="form-check-input" id="disableChat" data-field="disableChat">
						<label for="disableChat" class="form-check-label">[[admin/settings/chat:disable]]</label>
					</div>
				</div>

				<div class="mb-3">
					<div class="form-check form-switch">
						<input type="checkbox" class="form-check-input" id="disableChatMessageEditing" data-field="disableChatMessageEditing">
						<label for="disableChatMessageEditing" class="form-check-label">[[admin/settings/chat:disable-editing]]</label>
					</div>
					<p class="form-text">[[admin/settings/chat:disable-editing-help]]</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="chatEditDuration">[[admin/settings/chat:restrictions.seconds-edit-after]]</label>
					<input id="chatEditDuration" type="text" class="form-control" value="0" data-field="chatEditDuration">
					<p class="form-text">[[admin/settings/chat:zero-is-disabled]]</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="chatDeleteDuration">[[admin/settings/chat:restrictions.seconds-delete-after]]</label>
					<input id="chatDeleteDuration" type="text" class="form-control" value="0" data-field="chatDeleteDuration">
					<p class="form-text">[[admin/settings/chat:zero-is-disabled]]</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="maximumChatRoomNameLength">[[admin/settings/chat:max-chat-room-name-length]]</label>
					<input id="maximumChatRoomNameLength" type="text" class="form-control" value="50" data-field="maximumChatRoomNameLength">
					<p class="form-text">[[admin/settings/chat:zero-is-disabled]]</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="maximumChatMessageLength">[[admin/settings/chat:max-length]]</label>
					<input id="maximumChatMessageLength" type="text" class="form-control" value="1000" data-field="maximumChatMessageLength">
				</div>

				<div class="mb-3">
					<label class="form-label" for="maximumRemoteChatMessageLength">[[admin/settings/chat:max-length-remote]]</label>
					<input id="maximumRemoteChatMessageLength" type="text" class="form-control" value="5000" data-field="maximumRemoteChatMessageLength">
					<p class="form-text">[[admin/settings/chat:max-length-remote-help]]</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="maximumUsersInChatRoom">[[admin/settings/chat:max-room-size]]</label>
					<input id="maximumUsersInChatRoom" type="text" class="form-control" value="0" data-field="maximumUsersInChatRoom">
				</div>

				<div class="mb-3">
					<label class="form-label" for="chatMessageDelay">[[admin/settings/chat:delay]]</label>
					<input id="chatMessageDelay" type="text" class="form-control" data-field="chatMessageDelay">
				</div>

				<div class="mb-3">
					<label class="form-label" for="notificationSendDelay">[[admin/settings/chat:notification-delay]]</label>
					<input id="notificationSendDelay" type="text" class="form-control" value="60" data-field="notificationSendDelay">
					<p class="form-text">[[admin/settings/chat:notification-delay-help]]</p>
				</div>
			</div>
		</div>
		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>

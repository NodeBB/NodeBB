<div class="">
	{{{ if user.isAdmin }}}
	<div class="d-flex gap-2 mb-3 align-items-center gap-2">
		<label class="form-label text-nowrap mb-0">[[modules:chat.default-notification-setting]]</label>
		<select component="chat/room/notification/setting" class="form-select" style="width: 200px;">
			<option value="1" {{{ if (room.notificationSetting == "1") }}}selected{{{ end }}}>[[modules:chat.notification-setting-none]]</option>
			<option value="2" {{{ if (room.notificationSetting == "2") }}}selected{{{ end }}}>[[modules:chat.notification-setting-at-mention-only]]</option>
			<option value="3" {{{ if (room.notificationSetting == "3") }}}selected{{{ end }}}>[[modules:chat.notification-setting-all-messages]]</option>
		</select>
	</div>
	<div class="mb-3 d-flex gap-2 align-items-center">
		<label class="form-label">[[modules:chat.join-leave-messages]]</label>
		<div class="form-check form-switch">
			<input component="chat/room/join-leave-messages" class="form-check-input" type="checkbox" {{{ if room.joinLeaveMessages }}}checked{{{ end }}} />
		</div>
	</div>
	<hr/>
	{{{ end }}}

	<label class="form-label">[[modules:chat.add-user]]</label>
	<input component="chat/manage/user/add/search" class="form-control" type="text" placeholder="[[global:user-search-prompt]]" />
	<p class="text-danger"></p>
	<p class="form-text">[[modules:chat.add-user-help]]</p>

	<hr />

	<div class="row">
		<div class="col-12 {{{ if (user.isAdmin && room.public) }}}col-md-6{{{ end }}}">
			<label class="form-label">[[global:users]]</label>
			<input component="chat/manage/user/list/search" class="form-control mb-1" type="text" placeholder="[[global:user-search-prompt]]" />
			<ul component="chat/manage/user/list" class="list-group overflow-auto" style="max-height: 300px;">
				<li class="list-group-item"><i class="fa fa-spinner fa-spin"></i> [[modules:chat.retrieving-users]]</li>
			</ul>
		</div>
		{{{ if (user.isAdmin && room.public) }}}
		<div class="col-12 col-md-6 d-flex flex-column">
			<label class="form-label">[[modules:chat.select-groups]]</label>
			<select component="chat/room/groups" class="form-select flex-fill" multiple>
				{{{ each groups }}}
				<option value="{./displayName}" {{{ if ./selected }}}selected{{{ end }}}>{./displayName}</option>
				{{{ end }}}
			</select>
		</div>
		{{{ end }}}
	</div>
	{{{ if user.isAdmin }}}
	<hr/>
	<div class="d-flex justify-content-end">
		<button component="chat/manage/save" class="btn btn-sm btn-primary">[[global:save]]</button>
	</div>
	{{{ end }}}
</div>
<div class="">
	<label class="form-label">[[modules:chat.add-user]]</label>
	<input component="chat/manage/user/add/search" class="form-control" type="text" placeholder="[[global:user-search-prompt]]" />
	<p class="text-danger"></p>
	<p class="form-text">[[modules:chat.add-user-help]]</p>

	<hr />

	<label class="form-label">[[global:users]]</label>
	<input component="chat/manage/user/list/search" class="form-control mb-1" type="text" placeholder="[[global:user-search-prompt]]" />
	<ul component="chat/manage/user/list" class="list-group overflow-auto pe-1 mb-3" style="max-height: 300px;">
		<li class="list-group-item"><i class="fa fa-spinner fa-spin"></i> [[modules:chat.retrieving-users]]</li>
	</ul>

	{{{ if user.isAdmin }}}
	<hr/>
	<div class="d-flex gap-2 mb-3 align-items-center justify-content-between">
		<label class="form-label text-nowrap mb-0">[[modules:chat.default-notification-setting]]</label>
		<select component="chat/room/notification/setting" class="form-select" style="width: 200px;">
			<option value="1" {{{ if (room.notificationSetting == "1") }}}selected{{{ end }}}>[[modules:chat.notification-setting-none]]</option>
			<option value="2" {{{ if (room.notificationSetting == "2") }}}selected{{{ end }}}>[[modules:chat.notification-setting-at-mention-only]]</option>
			<option value="3" {{{ if (room.notificationSetting == "3") }}}selected{{{ end }}}>[[modules:chat.notification-setting-all-messages]]</option>
		</select>
	</div>

	{{{ if room.public }}}

	<label class="form-label">[[modules:chat.select-groups]]</label>

	<select component="chat/room/groups" class="form-select mb-3" multiple size="10">
		{{{ each groups }}}
		<option value="{./displayName}" {{{ if ./selected }}}selected{{{ end }}}>{./displayName}</option>
		{{{ end }}}
	</select>
	{{{ end }}}
	<div class="d-flex justify-content-end">
		<button component="chat/manage/save" class="btn btn-sm btn-primary">[[global:save]]</button>
	</div>
	{{{ end }}}
</div>
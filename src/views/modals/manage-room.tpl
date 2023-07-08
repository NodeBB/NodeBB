<div class="mb-3">
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

	{{{ if (user.isAdmin && group.public ) }}}
	<label class="form-label">[[modules:chat.select-groups]]</label>

	<select component="chat/room/groups" class="form-select mb-1" multiple size="10">
		{{{ each groups }}}
		<option value="{./displayName}" {{{ if ./selected }}}selected{{{ end }}}>{./displayName}</option>
		{{{ end }}}
	</select>
	<div class="d-flex justify-content-end">
		<button component="chat/manage/save/groups" class="btn btn-sm btn-primary">[[global:save]]</button>
	</div>
	{{{ end }}}
</div>
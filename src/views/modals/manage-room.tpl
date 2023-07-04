<div class="mb-3">
	<label class="form-label">[[modules:chat.add-user]]</label>
	<input class="form-control" type="text" placeholder="[[global:user-search-prompt]]" />
	<p class="text-danger"></p>
	<p class="form-text">[[modules:chat.add-user-help]]</p>

	<hr />

	<ul component="chat/manage/user/list" class="list-group overflow-auto pe-1 mb-3" style="max-height: 300px;">
		<li class="list-group-item"><i class="fa fa-spinner fa-spin"></i> [[modules:chat.retrieving-users]]</li>
	</ul>

	{{{ if (user.isAdmin && group.public ) }}}
	<label class="form-label">[[modules:chat.select-groups]]</label>
	<select component="chat/room/groups" class="form-select mb-3" multiple size="10">
		{{{ each groups }}}
		<option value="{./displayName}" {{{ if ./selected }}}selected{{{ end }}}>{./displayName}</option>
		{{{ end }}}
	</select>
	{{{ end }}}
</div>
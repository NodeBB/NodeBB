<div class="mb-3">
	<div class="mb-3">
		<label class="form-label text-nowrap">[[modules:chat.room-name-optional]]</label>
		<input component="chat/room/name" class="form-control" />
	</div>

	<div class="mb-3">
		<div class="dropdown">
			<label class="form-label">[[modules:chat.add-user]]</label>
			<input component="chat/search" class="form-control" type="text" placeholder="[[global:user-search-prompt]]" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false"/>
			<ul component="chat/search/list" class="dropdown-menu p-1 overflow-auto" style="max-height: 400px;" role="menu">
				<li component="chat/search/start-typing"><a href="#" class="dropdown-item rounded-1" role="menuitem">[[admin/menu:search.start-typing]]</a></li>
				<li component="chat/search/no-users" class="hidden"><a href="#" class="dropdown-item rounded-1" role="menuitem">[[users:no-users-found]]</a></li>
				{{{ each searchUsers }}}
				<li component="chat/search/user" data-uid="{./uid}"><a href="#" class="dropdown-item rounded-1" role="menuitem">{buildAvatar(@value, "24px", true)} {./username}</a></li>
				{{{ end }}}
			</ul>
		</div>
		<ul component="chat/room/users" class="list-group mt-2">
			{{{ each selectedUsers }}}
			<li class="list-group-item d-flex gap-2 align-items-center justify-content-between" component="chat/user" data-uid="{./uid}">
				<a href="#" class="text-reset text-decoration-none">{buildAvatar(@value, "24px", true)} {./username}</a>
				<button component="chat/room/users/remove" class="btn btn-sm btn-light"><i class="fa fa-times text-danger"></i></button>
			</li>
			{{{ end }}}
		</ul>
	</div>

	{{{ if user.isAdmin }}}
	<select component="chat/room/type" class="form-select mb-3">
		<option value="private">[[modules:chat.private.option]]</option>
		<option value="public">[[modules:chat.public.option]]</option>
	</select>

	<div component="chat/room/public/options" class="hidden">
		<select component="chat/room/groups" class="form-select" multiple size="10">
			{{{ each groups }}}
			<option value="{./displayName}">{./displayName}</option>
			{{{ end }}}
		</select>
		<p class="form-text">
			[[modules:chat.public.groups-help]]
		</p>
	</div>
	{{{ end }}}
</div>
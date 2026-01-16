<button type="button" class="btn btn-ghost btn-sm d-flex align-items-center gap-2 ff-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
	{{{ if selectedUser }}}
	<span class="fw-semibold">{buildAvatar(selectedUser, "20px", true, "not-responsive")} {selectedUser.username}</span>
	{{{ else }}}
	<span class="fw-semibold">[[users:all-users]]</span>
	{{{ end }}} <span class="caret text-primary opacity-75"></span>
</button>
<ul class="dropdown-menu p-1 text-sm" role="menu">
	<li role="presentation" class="user {{{ if !selectedUser}}}selected{{{end}}}">
		<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem" href="{config.relative_path}/{allUsersUrl}">
			<div class="flex-grow-1">[[users:all-users]]</div>
			<i class="flex-shrink-0 fa fa-fw {{{ if !selectedUser }}}fa-check{{{ end }}}"></i>
		</a>
	</li>
	{{{ each users }}}
	<li role="presentation" class="user {{{ if ./selected}}}selected{{{end}}}">
		<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem" href="{config.relative_path}/{./url}">
			<div class="flex-grow-1 d-inline-flex gap-1 align-items-center">{buildAvatar(@value, "24px", true, "not-responsive")} {./username}</div>
			<i class="flex-shrink-0 fa fa-fw {{{ if ./selected }}}fa-check{{{ end }}}"></i>
		</a>
	</li>
	{{{end}}}
</ul>

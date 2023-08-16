{{{ each users }}}
<li class="list-group-item d-flex align-items-center justify-content-between" data-uid="{./uid}" data-index="{./index}">
	<div class="d-flex gap-1 align-items-center">
		{buildAvatar(users, "24px", true)}
		<span>{./username} <i component="chat/manage/user/owner/icon" class="fa fa-star text-warning {{{ if !./isOwner }}}hidden{{{ end }}}" title="[[modules:chat.owner]]" data-bs-toggle="tooltip"></i></span>
	</div>
	<div class="d-flex gap-1">
		{{{ if ./canToggleOwner }}}
		<button class="btn btn-sm btn-light" data-bs-toggle="tooltip" data-action="toggleOwner" data-uid="{./uid}" title="[[modules:chat.grant-rescind-ownership]]"><i class="fa fa-star text-warning"></i></button>
		{{{ end }}}

		{{{ if ./canKick }}}
		<button class="btn btn-sm btn-light" data-action="kick" data-uid="{./uid}" data-bs-toggle="tooltip" title="[[modules:chat.kick]]"><i class="fa fa-ban text-danger"></i></button>
		{{{ end }}}
	</div>
</li>
{{{ end }}}
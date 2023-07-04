{{{ each users }}}
<li class="list-group-item d-flex align-items-center justify-content-between" data-index="{./index}">
	<div class="d-flex gap-1 align-items-center">
		{buildAvatar(users, "24px", true)}
		<span>{./username}{{{ if ./isOwner }}} <i class="fa fa-star text-warning" title="[[modules:chat.owner]]"></i>{{{ end }}}</span>
	</div>

	{{{ if ./canKick }}}
	<button class="btn btn-sm btn-link" data-action="kick" data-uid="{./uid}">[[modules:chat.kick]]</button>
	{{{ end }}}
</li>
{{{ end }}}
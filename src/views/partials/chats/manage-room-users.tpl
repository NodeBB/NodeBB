{{{ each users }}}
<li class="list-group-item">
	{{{ if ./canKick }}}<button class="float-end btn btn-sm btn-link" data-action="kick" data-uid="{../uid}">[[modules:chat.kick]]</button>{{{ end }}}
	{buildAvatar(users, "24px", true)}
	<span>{../username} {{{ if ./isOwner }}}<i class="fa fa-star text-warning" title="[[modules:chat.owner]]"></i>{{{ end }}}</span>
</li>
{{{ end }}}
{{{each users}}}
<li class="list-group-item">
	<!-- IF ../canKick --><button class="pull-right btn btn-xs btn-link" data-action="kick" data-uid="{../uid}">[[modules:chat.kick]]</button><!-- END -->
	{buildAvatar(users, "sm", true)}
	<span>{../username} <!-- IF ../isOwner --><i class="fa fa-star text-warning" title="[[modules:chat.owner]]"></i><!-- END --></span>
</li>
{{{end}}}
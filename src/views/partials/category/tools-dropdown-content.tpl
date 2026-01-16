<button class="btn btn-ghost btn-sm ff-secondary d-flex gap-2 align-items-center dropdown-toggle" data-bs-toggle="dropdown" type="button" aria-haspopup="true" aria-expanded="false">
	<i class="fa fa-fw fa-gear text-primary"></i>
	<span class="visible-md-inline visible-lg-inline fw-semibold">[[topic:thread-tools.title]]</span>
	<span component="topic/selected/badge" class="badge rounded-pill bg-secondary"></span>
</button>
<ul class="dropdown-menu p-1 text-sm" role="menu">
	<li>
		<a component="topic/mark-unread-for-all" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem">
			<i class="fa fa-fw fa-inbox text-secondary"></i> [[topic:thread-tools.markAsUnreadForAll]]
		</a>
	</li>
	<li>
		<a component="topic/pin" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem">
			<i class="fa fa-fw fa-thumb-tack text-secondary"></i> [[topic:thread-tools.pin]]
		</a>
	</li>
	<li>
		<a component="topic/unpin" href="#" class="hidden dropdown-item rounded-1" role="menuitem">
			<i class="fa fa-fw fa-thumb-tack fa-rotate-90 text-secondary"></i> [[topic:thread-tools.unpin]]
		</a>
	</li>

	<li>
		<a component="topic/lock" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem">
			<i class="fa fa-fw fa-lock text-secondary"></i> [[topic:thread-tools.lock]]
		</a>
	</li>
	<li>
		<a component="topic/unlock" href="#" class="hidden dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem">
			<i class="fa fa-fw fa-unlock text-secondary"></i> [[topic:thread-tools.unlock]]
		</a>
	</li>

	<li class="dropdown-divider"></li>

	<li>
		<a component="topic/move" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem">
			<i class="fa fa-fw fa-arrows text-secondary"></i> [[topic:thread-tools.move]]
		</a>
	</li>
	{{{if template.category}}}
	<li>
		<a component="topic/move-all" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem">
			<i class="fa fa-fw fa-arrows text-secondary"></i> [[topic:thread-tools.move-all]]
		</a>
	</li>
	{{{end}}}
	<li>
		<a component="topic/merge" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem">
			<i class="fa fa-fw fa-code-fork text-secondary"></i> [[topic:thread-tools.merge]]
		</a>
	</li>

	<li>
		<a component="topic/tag" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem">
			<i class="fa fa-fw fa-tag text-secondary"></i> [[topic:thread-tools.tag]]
		</a>
	</li>

	<li class="dropdown-divider"></li>

	<li>
		<a component="topic/delete" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem">
			<i class="fa fa-fw fa-trash-o text-secondary"></i> [[topic:thread-tools.delete]]
		</a>
	</li>
	<li>
		<a component="topic/restore" href="#" class="hidden dropdown-item rounded-1" role="menuitem">
			<i class="fa fa-fw fa-history text-secondary"></i> [[topic:thread-tools.restore]]
		</a>
	</li>
	<li>
		<a component="topic/purge" href="#" class="hidden dropdown-item rounded-1" role="menuitem">
			<i class="fa fa-fw fa-eraser text-secondary"></i> [[topic:thread-tools.purge]]
		</a>
	</li>

	{{{each thread_tools}}}
	<li>
		<a href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2 {thread_tools.class}" role="menuitem">
			<i class="fa fa-fw {thread_tools.icon} text-secondary"></i>
			{thread_tools.title}</a>
	</li>
	{{{end}}}
</ul>
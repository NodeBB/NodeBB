{{{ if privileges.editable }}}
<li {{{ if locked }}}hidden{{{ end }}}>
	<a component="topic/lock" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2 {{{ if locked }}}hidden{{{ end }}}" role="menuitem"><i class="fa fa-fw fa-lock text-secondary"></i> [[topic:thread-tools.lock]]</a>
</li>

<li {{{ if !locked }}}hidden{{{ end }}}>
	<a component="topic/unlock" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2 {{{ if !locked }}}hidden{{{ end }}}" role="menuitem"><i class="fa fa-fw fa-unlock text-secondary"></i> [[topic:thread-tools.unlock]]</a>
</li>

<li {{{ if pinned }}}hidden{{{ end }}}>
	<a component="topic/pin" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2 {{{ if pinned }}}hidden{{{ end }}}" role="menuitem"><i class="fa fa-fw fa-thumb-tack text-secondary"></i> [[topic:thread-tools.pin]]</a>
</li>

<li {{{ if !pinned }}}hidden{{{ end }}}>
	<a component="topic/unpin" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2 {{{ if !pinned }}}hidden{{{ end }}}" role="menuitem"><i class="fa fa-fw fa-thumb-tack fa-rotate-90 text-secondary"></i> [[topic:thread-tools.unpin]]</a>
</li>

{{{ if isNumber(cid) }}}
<li>
	<a component="topic/move" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem"><i class="fa fa-fw fa-arrows text-secondary"></i> [[topic:thread-tools.move]]</a>
</li>
{{{ end }}}

<li>
	<a component="topic/merge" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem"><i class="fa fa-fw fa-code-fork text-secondary"></i> [[topic:thread-tools.merge]]</a>
</li>

<li>
	<a component="topic/fork" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem"><i class="fa fa-fw fa-code-fork text-secondary"></i> [[topic:thread-tools.fork]]</a>
</li>

<li>
	<a component="topic/tag" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem"><i class="fa fa-fw fa-tag text-secondary"></i> [[topic:thread-tools.tag]]</a>
</li>

{{{ if !scheduled }}}
<li>
	<a component="topic/move-posts" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem"><i class="fa fa-fw fa-arrows text-secondary"></i> [[topic:thread-tools.move-posts]]</a>
</li>
{{{ end }}}

<li>
	<a component="topic/mark-unread-for-all" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem"><i class="fa fa-fw fa-inbox text-secondary"></i> [[topic:thread-tools.markAsUnreadForAll]]</a>
</li>

<li class="dropdown-divider"></li>
{{{ end }}}

{{{ if privileges.deletable }}}
<li {{{ if deleted }}}hidden{{{ end }}}>
	<a component="topic/delete" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2 {{{ if deleted }}}hidden{{{ end }}}" role="menuitem"><i class="fa fa-fw fa-trash-o text-secondary"></i> [[topic:thread-tools.delete]]</a>
</li>

{{{ if !scheduled }}}
<li {{{ if !deleted }}}hidden{{{ end }}}>
	<a component="topic/restore" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2 {{{ if !deleted }}}hidden{{{ end }}}" role="menuitem"><i class="fa fa-fw fa-history text-secondary"></i> [[topic:thread-tools.restore]]</a>
</li>
{{{ end }}}

{{{ if privileges.purge }}}
<li {{{ if !deleted }}}hidden{{{ end }}}>
	<a component="topic/purge" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2 {{{ if !deleted }}}hidden{{{ end }}}" role="menuitem"><i class="fa fa-fw fa-eraser text-secondary"></i> [[topic:thread-tools.purge]]</a>
</li>
{{{ end }}}
{{{ if privileges.isAdminOrMod }}}
<li>
	<a component="topic/delete/posts" href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem"><i class="fa fa-fw fa-trash-o text-secondary"></i> [[topic:thread-tools.delete-posts]]</a>
</li>
{{{ end }}}
{{{ end }}}
<!-- plugins only add to thread_tools if user has permission to perform action -->
{{{ each thread_tools }}}
<li>
	<a href="#" class="dropdown-item rounded-1 d-flex align-items-center gap-2 {./class}" role="menuitem"><i class="fa fa-fw text-secondary {./icon}"></i> {./title}</a>
</li>
{{{ end }}}

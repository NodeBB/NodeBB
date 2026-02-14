{{{ if posts.display_moderator_tools }}}
<li>
	<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" component="post/edit" role="menuitem" href="#">
		<span class="menu-icon"><i class="fa fa-fw text-secondary fa-pencil"></i></span> [[topic:edit]]
	</a>
</li>
{{{ if posts.display_delete_tools }}}
<li {{{ if posts.deleted }}}hidden{{{ end }}}>
	<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" component="post/delete" role="menuitem" href="#" class="{{{ if posts.deleted }}}hidden{{{ end }}}">
		<span class="menu-icon"><i class="fa fa-fw text-secondary fa-trash-o"></i></span> [[topic:delete]]
	</a>
</li>
<li {{{ if !posts.deleted }}}hidden{{{ end }}}>
	<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" component="post/restore" role="menuitem" href="#" class="{{{ if !posts.deleted }}}hidden{{{ end }}}">
		<span class="menu-icon"><i class="fa fa-fw text-secondary fa-history"></i></span> [[topic:restore]]
	</a>
</li>
{{{ end }}}
{{{ if posts.display_purge_tools }}}
<li {{{ if !posts.deleted }}}hidden{{{ end }}}>
	<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" component="post/purge" role="menuitem" href="#" class="{{{ if !posts.deleted }}}hidden{{{ end }}}">
		<span class="menu-icon"><i class="fa fa-fw text-secondary fa-eraser"></i></span> [[topic:purge]]
	</a>
</li>
{{{ end }}}

{{{ if posts.display_move_tools }}}
<li>
	<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" component="post/move" role="menuitem" href="#">
		<span class="menu-icon"><i class="fa fa-fw text-secondary fa-arrows"></i></span> [[topic:move]]
	</a>
</li>
{{{ end }}}

{{{ if posts.display_change_owner_tools }}}
<li>
	<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" component="post/change-owner" role="menuitem" href="#">
		<span class="menu-icon"><i class="fa fa-fw text-secondary fa-user"></i></span> [[topic:change-owner]]
	</a>
</li>
{{{ end }}}

{{{ if posts.display_manage_editors_tools }}}
<li>
	<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" component="post/manage-editors" role="menuitem" href="#">
		<span class="menu-icon"><i class="fa fa-fw text-secondary fa-user-pen"></i></span> [[topic:manage-editors]]
	</a>
</li>
{{{ end }}}

{{{ if posts.ip }}}
<li>
	<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" component="post/copy-ip" role="menuitem" href="#" data-clipboard-text="{posts.ip}">
		<span class="menu-icon" ><i class="fa fa-fw text-secondary fa-copy"></i></span> [[topic:copy-ip]] {posts.ip}
	</a>
</li>
{{{ if posts.display_ip_ban }}}
<li>
	<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" component="post/ban-ip" role="menuitem" href="#" data-ip="{posts.ip}">
		<span class="menu-icon"><i class="fa fa-fw text-secondary fa-ban"></i></span> [[topic:ban-ip]] {posts.ip}
	</a>
</li>
{{{ end }}}
{{{ end }}}
{{{ end }}}

{{{ each posts.tools }}}
<li {{{ if ./disabled }}}class="disabled" {{{ end }}}>
	<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" {{{ if ./action}}}component="{./action}"{{{ end }}} role="menuitem" href="{{{ if ./href }}}{./href}{{{ else }}}#{{{ end }}}">
		<span class="menu-icon"><i class="fa fa-fw text-secondary {./icon}"></i></span> {{./html}}
	</a>
</li>
{{{ end }}}

{{{ if !posts.deleted }}}
	{{{ if posts.display_history}}}
	<li>
		<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" component="post/view-history" role="menuitem" href="#">
			<span class="menu-icon"><i class="fa fa-fw text-secondary fa-history"></i></span> [[topic:view-history]]
		</a>
	</li>
	{{{ end }}}

	{{{ if config.loggedIn }}}
	<li>
		<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" component="post/bookmark" role="menuitem" href="#" data-bookmarked="{posts.bookmarked}">
			<span class="menu-icon">
				<i component="post/bookmark/on" class="fa fa-fw text-secondary fa-bookmark {{{ if !posts.bookmarked }}}hidden{{{ end }}}"></i>
				<i component="post/bookmark/off" class="fa fa-fw text-secondary fa-bookmark-o {{{ if posts.bookmarked }}}hidden{{{ end }}}"></i>
			</span>
			<span class="bookmark-text">[[topic:bookmark]]</span>
			<span component="post/bookmark-count" class="bookmarkCount badge bg-secondary" data-bookmarks="{posts.bookmarks}">{posts.bookmarks}</span>&nbsp;
		</a>
	</li>
	{{{ end }}}


	{{{ if !posts.display_original_url }}}
	<li>
		<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem" href="#" data-clipboard-text="{posts.absolute_url}">
			<i class="fa fa-fw text-secondary fa-link"></i> [[topic:copy-permalink]]
		</a>
	</li>
	{{{ else }}}
	<li>
		<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem" href="#" data-clipboard-text="{{{ if posts.url }}}{posts.url}{{{ else }}}{posts.pid}{{{ end }}}">
			<i class="fa fa-fw text-secondary fa-link"></i> [[topic:copy-permalink]]
		</a>
	</li>
	<li>
		<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem" target="_self" href="{{{ if posts.url }}}{posts.url}{{{ else }}}{posts.pid}{{{ end }}}">
			<i class="fa fa-fw text-secondary fa-external-link"></i> [[topic:go-to-original]]
		</a>
	</li>
	{{{ end }}}

	{{{ if postSharing.length }}}
	{{{ if config.loggedIn }}}<li class="dropdown-divider"></li>{{{ end }}}
	<li class="dropdown-header">[[topic:share-this-post]]</li>
	{{{ end }}}
	<li class="d-flex gap-2 px-3">
		{{{ each postSharing }}}
		<a class="dropdown-item rounded-1 d-flex align-items-center px-1 py-2 w-auto" role="menuitem" component="share/{./id}" href="#" title="{./name}"><i class="fa-fw text-secondary {./class}"></i></a>
		{{{ end }}}
	</li>
{{{ end }}}

{{{ if posts.display_flag_tools }}}
<li class="dropdown-divider"></li>

<li {{{ if posts.flags.flagged }}}hidden{{{ end }}}>
	<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" component="post/flag" role="menuitem" href="#"><i class="fa fa-fw text-secondary fa-flag"></i> [[topic:flag-post]]</a>
</li>
<li {{{ if !posts.flags.flagged }}}hidden{{{ end }}} class="disabled text-secondary">
	<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" component="post/already-flagged" role="menuitem" href="#" data-flag-id="{posts.flagId}"><i class="fa fa-fw text-secondary fa-flag"></i> [[topic:already-flagged]]</a>
</li>

{{{ if (!posts.selfPost && posts.uid) }}}
<li>
	<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" component="post/flagUser" role="menuitem" href="#"><i class="fa fa-fw text-secondary fa-flag"></i> [[topic:flag-user]]</a>
</li>
{{{ end }}}
{{{ end }}}

{{{ if posts.display_moderator_tools }}}
{{{ if posts.flags.exists }}}
<li>
	<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem" href="{config.relative_path}/flags/{posts.flags.flagId}"><i class="fa fa-fw text-secondary fa-exclamation-circle"></i> [[topic:view-flag-report]]</a>
</li>
{{{ if (posts.flags.state == "open") }}}
<li>
	<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" component="post/flagResolve" data-flagId="{posts.flags.flagId}" role="menuitem" href="#"><i class="fa fa-fw text-secondary fa-check"></i> [[topic:resolve-flag]]</a>
</li>
{{{ end }}}
{{{ end }}}
{{{ end }}}

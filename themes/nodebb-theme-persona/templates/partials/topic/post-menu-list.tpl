<!-- IF posts.display_moderator_tools -->
<li class="dropdown-header">[[topic:tools]]</li>
<li>
	<a component="post/edit" role="menuitem" tabindex="-1" href="#">
		<span class="menu-icon"><i class="fa fa-fw fa-pencil"></i></span> [[topic:edit]]
	</a>
</li>
<li <!-- IF posts.deleted -->hidden<!-- ENDIF posts.deleted -->>
	<a component="post/delete" role="menuitem" tabindex="-1" href="#" class="<!-- IF posts.deleted -->hidden<!-- ENDIF posts.deleted -->">
		<div class="inline menu-icon"><i class="fa fa-fw fa-trash-o"></i></div> <span>[[topic:delete]]</span>
	</a>
</li>
<li <!-- IF !posts.deleted -->hidden<!-- ENDIF !posts.deleted -->>
	<a component="post/restore" role="menuitem" tabindex="-1" href="#" class="<!-- IF !posts.deleted -->hidden<!-- ENDIF !posts.deleted -->">
		<div class="inline menu-icon"><i class="fa fa-fw fa-history"></i></div> <span>[[topic:restore]]</span>
	</a>
</li>
<!-- IF posts.display_purge_tools -->
<li <!-- IF !posts.deleted -->hidden<!-- ENDIF !posts.deleted -->>
	<a component="post/purge" role="menuitem" tabindex="-1" href="#" class="<!-- IF !posts.deleted -->hidden<!-- ENDIF !posts.deleted -->">
		<span class="menu-icon"><i class="fa fa-fw fa-eraser"></i></span> [[topic:purge]]
	</a>
</li>
<!-- END -->

<!-- IF posts.display_move_tools -->
<li>
	<a component="post/move" role="menuitem" tabindex="-1" href="#">
		<span class="menu-icon"><i class="fa fa-fw fa-arrows"></i></span> [[topic:move]]
	</a>
</li>
<!-- ENDIF posts.display_move_tools -->

<!-- IF posts.display_change_owner_tools -->
<li>
	<a component="post/change-owner" role="menuitem" tabindex="-1" href="#">
		<span class="menu-icon"><i class="fa fa-fw fa-user"></i></span> [[topic:change-owner]]
	</a>
</li>
<!-- ENDIF posts.display_change_owner_tools -->

<!-- IF posts.ip -->
<li>
	<a component="post/copy-ip" role="menuitem" tabindex="-1" href="#" data-clipboard-text="{posts.ip}">
		<span class="menu-icon" ><i class="fa fa-fw fa-copy"></i></span> [[topic:copy-ip]] {posts.ip}
	</a>
</li>
<!-- IF posts.display_ip_ban -->
<li>
	<a component="post/ban-ip" role="menuitem" tabindex="-1" href="#" data-ip="{posts.ip}">
		<span class="menu-icon"><i class="fa fa-fw fa-ban"></i></span> [[topic:ban-ip]] {posts.ip}
	</a>
</li>
<!-- ENDIF posts.display_ip_ban -->
<!-- ENDIF posts.ip -->
<!-- ENDIF posts.display_moderator_tools -->

{{{each posts.tools}}}
<li {{{ if ./disabled }}}class="disabled" {{{ end }}}>
	<a {{{ if ./action}}}component="{./action}"{{{ end }}} role="menuitem" tabindex="-1" href="{{{ if ./href }}}{./href}{{{ else }}}#{{{ end }}}">
		<span class="menu-icon"><i class="fa fa-fw {posts.tools.icon}"></i></span> {{posts.tools.html}}
	</a>
</li>
{{{end}}}

<!-- IF !posts.deleted -->
	<!-- IF posts.display_history -->
	<li>
		<a component="post/view-history" role="menuitem" tabindex="-1" href="#">
			<span class="menu-icon"><i class="fa fa-fw fa-history"></i></span> [[topic:view-history]]
		</a>
	</li>
	<!-- END -->

	{{{ if config.loggedIn }}}
	<li>
		<a component="post/bookmark" role="menuitem" tabindex="-1" href="#" data-bookmarked="{posts.bookmarked}">
			<span class="menu-icon">
				<i component="post/bookmark/on" class="fa fa-fw fa-heart <!-- IF !posts.bookmarked -->hidden<!-- ENDIF !posts.bookmarked -->"></i>
				<i component="post/bookmark/off" class="fa fa-fw fa-heart-o <!-- IF posts.bookmarked -->hidden<!-- ENDIF posts.bookmarked -->"></i>
			</span>
			<span class="bookmark-text">[[topic:bookmark]]</span>
			<span component="post/bookmark-count" class="bookmarkCount badge" data-bookmarks="{posts.bookmarks}">{posts.bookmarks}</span>&nbsp;
		</a>
	</li>
	{{{ end }}}

	<li>
		<a role="menuitem" tabindex="-1" href="#" data-clipboard-text="{posts.absolute_url}">
			<i class="fa fa-fw fa-link"></i> [[topic:copy-permalink]]
		</a>
	</li>

	<!-- IF postSharing.length -->
	<!-- IF config.loggedIn --><li class="divider"></li><!-- ENDIF config.loggedIn -->
	<li class="dropdown-header">[[topic:share_this_post]]</li>
	<!-- ENDIF postSharing.length -->
	{{{each postSharing}}}
		<li>
			<a role="menuitem" component="share/{postSharing.id}" tabindex="-1" href="#"><span class="menu-icon"><i class="fa fa-fw {postSharing.class}"></i></span> {postSharing.name}</a>
		</li>
	{{{end}}}
<!-- ENDIF !posts.deleted -->

{{{ if posts.display_flag_tools }}}
<li class="divider"></li>

<li {{{ if posts.flags.flagged }}}hidden{{{ end }}}>
	<a component="post/flag" role="menuitem" tabindex="-1" href="#"><i class="fa fa-fw fa-flag"></i> [[topic:flag-post]]</a>
</li>
<li {{{ if !posts.flags.flagged }}}hidden{{{ end }}} class="disabled text-muted">
	<a component="post/already-flagged" role="menuitem" tabindex="-1" href="#"><i class="fa fa-fw fa-flag"></i> [[topic:already-flagged]]</a>
</li>

{{{ if (!posts.selfPost && posts.uid) }}}
<li>
	<a component="post/flagUser" role="menuitem" tabindex="-1" href="#"><i class="fa fa-fw fa-flag"></i> [[topic:flag-user]]</a>
</li>
{{{ end }}}
{{{ end }}}

<!-- IF posts.display_moderator_tools -->
{{{ if posts.flags.exists }}}
<li><a role="menuitem" tabindex="-1" href="{config.relative_path}/flags/{posts.flags.flagId}"><i class="fa fa-fw fa-exclamation-circle"></i> [[topic:view-flag-report]]</a></li>
{{{ if (posts.flags.state == "open") }}}
<li><a component="post/flagResolve" data-flagId="{posts.flags.flagId}" role="menuitem" tabindex="-1" href="#"><i class="fa fa-fw fa-check"></i> [[topic:resolve-flag]]</a></li>
{{{ end }}}
{{{ end }}}
<!-- ENDIF posts.display_moderator_tools -->

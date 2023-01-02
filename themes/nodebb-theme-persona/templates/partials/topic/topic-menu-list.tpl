<!-- IF privileges.editable -->
<li <!-- IF locked -->hidden<!-- ENDIF locked -->><a component="topic/lock" href="#" class="<!-- IF locked -->hidden<!-- ENDIF locked -->"><i class="fa fa-fw fa-lock"></i> [[topic:thread_tools.lock]]</a></li>
<li <!-- IF !locked -->hidden<!-- ENDIF !locked -->><a component="topic/unlock" href="#" class="<!-- IF !locked -->hidden<!-- ENDIF !locked -->"><i class="fa fa-fw fa-unlock"></i> [[topic:thread_tools.unlock]]</a></li>
<li><a component="topic/move" href="#"><i class="fa fa-fw fa-arrows"></i> [[topic:thread_tools.move]]</a></li>
<li><a component="topic/fork" href="#"><i class="fa fa-fw fa-code-fork"></i> [[topic:thread_tools.fork]]</a></li>
{{{ if !scheduled }}}
<li <!-- IF pinned -->hidden<!-- ENDIF pinned -->><a component="topic/pin" href="#" class="<!-- IF pinned -->hidden<!-- ENDIF pinned -->"><i class="fa fa-fw fa-thumb-tack"></i> [[topic:thread_tools.pin]]</a></li>
<li <!-- IF !pinned -->hidden<!-- ENDIF !pinned -->><a component="topic/unpin" href="#" class="<!-- IF !pinned -->hidden<!-- ENDIF !pinned -->"><i class="fa fa-fw fa-thumb-tack fa-rotate-90"></i> [[topic:thread_tools.unpin]]</a></li>
<li><a component="topic/move-posts" href="#"><i class="fa fa-fw fa-arrows"></i> [[topic:thread_tools.move-posts]]</a></li>
{{{ end }}}
<li><a component="topic/mark-unread-for-all" href="#"><i class="fa fa-fw fa-inbox"></i> [[topic:thread_tools.markAsUnreadForAll]]</a></li>
<li class="divider"></li>
<!-- ENDIF privileges.editable -->

<!-- IF privileges.deletable -->
<li <!-- IF deleted -->hidden<!-- ENDIF deleted -->><a component="topic/delete" href="#" class="<!-- IF deleted -->hidden<!-- ENDIF deleted -->"><i class="fa fa-fw fa-trash-o"></i> [[topic:thread_tools.delete]]</a></li>
{{{ if !scheduled }}}
<li <!-- IF !deleted -->hidden<!-- ENDIF !deleted -->><a component="topic/restore" href="#" class="<!-- IF !deleted -->hidden<!-- ENDIF !deleted -->"><i class="fa fa-fw fa-history"></i> [[topic:thread_tools.restore]]</a></li>
{{{ end }}}
<!-- IF privileges.purge -->
<li <!-- IF !deleted -->hidden<!-- ENDIF !deleted -->><a component="topic/purge" href="#" class="<!-- IF !deleted -->hidden<!-- ENDIF !deleted -->"><i class="fa fa-fw fa-eraser"></i> [[topic:thread_tools.purge]]</a></li>
<!-- END -->
<!-- IF privileges.isAdminOrMod -->
<li><a component="topic/delete/posts" href="#"><i class="fa fa-fw fa-trash-o"></i> [[topic:thread_tools.delete-posts]]</a></li>
<!-- ENDIF privileges.isAdminOrMod -->

{{{each thread_tools}}}
<li><a href="#" class="{thread_tools.class}"><i class="fa fa-fw {thread_tools.icon}"></i> {thread_tools.title}</a></li>
{{{end}}}
<!-- ENDIF privileges.deletable -->
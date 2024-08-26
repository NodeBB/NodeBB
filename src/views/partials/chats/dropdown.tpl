{{{ if !rooms.length }}}
<li class="text-center p-4 d-flex flex-column">
    <div class="p-4"><i class="fa-solid fa-wind fs-2 text-muted"></i></div>
	<div class="text-xs fw-semibold text-muted">[[modules:chat.no-active]]</div>
</li>
{{{ end }}}

{{{ each rooms }}}
<!-- IMPORT partials/chats/recent_room.tpl -->
{{{ end }}}
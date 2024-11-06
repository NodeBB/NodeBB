<div class="row h-100">
	<div class="h-100 {{{if widgets.sidebar.length }}}col-lg-9 col-sm-12{{{ else }}}col-lg-12{{{ end }}}">
		<div class="chats-full d-flex gap-1 h-100 mt-3 mt-md-0 py-md-3">
			<div component="chat/nav-wrapper" class="flex-shrink-0 d-flex flex-column h-100 gap-1" data-loaded="{{{ if roomId }}}1{{{ else }}}0{{{ end }}}">

				<div>
					<button component="chat/create" class="btn btn-primary btn-sm w-100">[[modules:chat.create-room]]</button>
				</div>

				{{{ if publicRooms.length }}}
				<hr class="my-1">

				<div class="d-flex flex-column gap-1">
					<div class="d-flex gap-1 align-items-center justify-content-between justify-content-lg-start">
						<button class="btn btn-ghost btn-sm p-1 order-1 order-lg-0" data-bs-toggle="collapse" data-bs-target="#public-rooms"
						onclick="$(this).find('i').toggleClass('fa-rotate-180');"><i class="fa fa-fw fa-chevron-up" style="transition: 0.25s ease;"></i></button>
						<label class="text-sm text-muted lh-1">[[modules:chat.public-rooms, {publicRooms.length}]]</label>
					</div>
					<div id="public-rooms" component="chat/public" class="collapse show">
						<div class="d-flex gap-1 flex-column">
							{{{ each publicRooms }}}
							<div component="chat/public/room" class="btn btn-ghost btn-sm ff-sans d-flex justify-content-between hover-parent {{{ if ./unread}}}unread{{{ end }}}" data-roomid="{./roomId}">
								<div class="d-flex gap-1 align-items-center"><i class="fa {./icon} text-muted"></i> {./roomName} <div component="chat/public/room/unread/count" data-count="{./unreadCount}" class="badge border bg-light text-primary {{{ if !./unreadCount }}}hidden{{{ end }}}">{./unreadCountText}</div></div>
								<div>
									<div component="chat/public/room/sort/handle" class="text-muted {{{ if isAdmin }}}hover-d-block{{{ else }}}d-none{{{ end }}}" style="cursor:grab;"><i class="fa fa-bars"></i></div>
								</div>
							</div>
							{{{ end }}}
						</div>
					</div>
				</div>
				{{{ end }}}

				<hr class="my-1">

				<div class="d-flex flex-column gap-1 overflow-auto">
					{{{ if rooms.length }}}
					<div class="d-flex gap-1 align-items-center justify-content-between justify-content-lg-start">
						<button class="btn btn-ghost btn-sm p-1 order-1 order-lg-0" data-bs-toggle="collapse" data-bs-target="#private-rooms"
						onclick="$(this).find('i').toggleClass('fa-rotate-180')"><i class="fa fa-fw fa-chevron-up" style="transition: 0.25s ease;"></i></button>
						<label class="text-sm text-muted lh-1">[[modules:chat.private-rooms, {privateRoomCount}]]</label>
					</div>
					{{{ end }}}

					<div id="private-rooms" component="chat/recent" class="chats-list overflow-auto mb-0 pe-1 pb-5 pb-lg-0 collapse show ghost-scrollbar" data-nextstart="{nextStart}">
						{{{ each rooms }}}
						<!-- IMPORT partials/chats/recent_room.tpl -->
						{{{ end }}}
					</div>
				</div>
			</div>
			<div component="chat/main-wrapper" class="flex-grow-1 ms-md-2 ps-md-2 border-1 border-start-md h-100" style="min-width: 0;" data-roomid="{roomId}">
				<!-- IMPORT partials/chats/message-window.tpl -->
			</div>
			<div class="imagedrop"><div>[[topic:composer.drag-and-drop-images]]</div></div>
		</div>
	</div>
	<div data-widget-area="sidebar" class="h-100 col-lg-3 col-sm-12 {{{ if !widgets.sidebar.length }}}hidden{{{ end }}}">
		{{{ each widgets.sidebar }}}
		{{widgets.sidebar.html}}
		{{{ end }}}
	</div>
</div>

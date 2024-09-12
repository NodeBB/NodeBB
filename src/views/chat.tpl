<div id="chat-modal" class="chat-modal d-flex flex-nowrap modal hide overflow-visible" tabindex="-1" role="dialog" aria-labelledby="Chat" aria-hidden="true" data-center="false">
	<div class="modal-dialog">
		<div class="modal-content" component="chat/message/window">
			<div class="modal-header d-flex gap-4 justify-content-between">
				<div class="fs-6 flex-grow-1 fw-semibold tracking-tight text-truncate text-nowrap" component="chat/room/name" data-icon="{icon}">{{{ if ./roomName }}}<i class="fa {icon} text-muted"></i> {roomName}{{{ else }}}{./chatWithMessage}{{{ end}}}</div>
				<div class="d-flex gap-1 align-items-center">
					<button type="button" class="btn btn-ghost btn-sm d-none d-md-flex align-self-stretch align-items-center" data-action="maximize" title="[[modules:chat.maximize]]" data-bs-toggle="tooltip" data-bs-placement="bottom">
						<i class="fa fa-fw fa-expand text-muted"></i>
					</button>

					<!-- IMPORT partials/chats/options.tpl -->

					<button id="chat-close-btn" type="button" class="btn-close btn btn-ghost btn-sm" aria-label="Close"></button>
				</div>
			</div>
			<!-- IMPORT partials/chats/scroll-up-alert.tpl -->
			<div class="modal-body d-flex flex-column" style="height: 500px;">
				<div class="d-flex flex-grow-1 gap-1 overflow-auto" style="min-width: 0px;">
					<div component="chat/messages" class="expanded-chat d-flex flex-column flex-grow-1" data-roomid="{roomId}" style="min-width: 0px;">

						<ul component="chat/message/content" class="chat-content p-0 m-0 list-unstyled overflow-auto flex-grow-1">
							<!-- IMPORT partials/chats/messages.tpl -->
						</ul>
						<ul component="chat/message/search/results" class="chat-content p-0 m-0 list-unstyled overflow-auto flex-grow-1 hidden">
							<div component="chat/message/search/no-results" class="text-center p-4 d-flex flex-column">
								<div class="p-4"><i class="fa-solid fa-wind fs-2 text-muted"></i></div>
								<div class="text-xs fw-semibold text-muted">[[search:no-matches]]</div>
							</div>
						</ul>
						<!-- IMPORT partials/chats/composer.tpl -->
					</div>
				</div>
			</div>
			<div class="imagedrop"><div>[[topic:composer.drag-and-drop-images]]</div></div>
		</div>
	</div>
</div>

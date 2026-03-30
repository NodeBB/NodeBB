<li component="chat/message" class="chat-message mx-2 pe-2 {{{ if messages.deleted }}} deleted{{{ end }}} {{{ if messages.pinned}}} pinned{{{ end }}} {{{ if messages.newSet }}}border-top pt-3{{{ end }}}" data-mid="{messages.messageId}" data-uid="{messages.fromuid}" data-index="{messages.index}" data-self="{messages.self}" data-break="{messages.newSet}" data-timestamp="{messages.timestamp}" data-username="{messages.fromUser.username}" data-displayname="{messages.fromUser.displayname}">

	{{{ if messages.parent }}}
	<!-- IMPORT partials/chats/parent.tpl -->
	{{{ end }}}

	<div class="message-header lh-1 d-flex align-items-center gap-2 text-sm {{{ if !messages.newSet }}}hidden{{{ end }}} pb-2">
		<a href="{config.relative_path}/user/{messages.fromUser.userslug}" class="text-decoration-none">{buildAvatar(messages.fromUser, "18px", true, "not-responsive")}</a>
		<span class="chat-user fw-semibold"><a href="{config.relative_path}/user/{messages.fromUser.userslug}">{messages.fromUser.displayname}</a></span>
		{{{ if messages.fromUser.banned }}}
		<span class="badge bg-danger">[[user:banned]]</span>
		{{{ end }}}
		{{{ if messages.fromUser.deleted }}}
		<span class="badge bg-danger">[[user:deleted]]</span>
		{{{ end }}}
		<span class="chat-timestamp text-muted timeago" title="{messages.timestampISO}"></span>

		<div component="chat/message/edited" class="text-muted ms-auto {{{ if !messages.edited }}}hidden{{{ end }}}" title="[[global:edited-timestamp, {isoTimeToLocaleString(messages.editedISO, config.userLang)}]]"><i class="fa fa-edit"></i></span></div>
	</div>
	<div class="message-body-wrapper">
		<div component="chat/message/body" class="message-body ps-0 py-0 overflow-auto text-break">
			{messages.content}
		</div>
		<!-- IMPORT partials/chats/reactions.tpl -->
		<div component="chat/message/controls" class="position-relative">
			<div class="btn-group border shadow-sm controls position-absolute bg-body end-0" style="bottom:1rem;">
				<!-- IMPORT partials/chats/add-reaction.tpl -->
				<button class="btn btn-sm btn-link" data-action="reply" title="[[topic:reply]]"><i class="fa fa-reply"></i></button>

				<div class="btn-group d-inline-block">
					<button class="btn btn-sm btn-link dropdown-toggle" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false"><i class="fa fa-ellipsis" type="button"></i></button>
					<ul class="dropdown-menu dropdown-menu-end p-1 text-sm list-unstyled" role="menu">
						{{{ if (isAdminOrGlobalMod || (!config.disableChatMessageEditing && messages.self)) }}}
						<li>
							<a href="#" class="dropdown-item rounded-1" data-action="edit" role="menuitem"><span class="d-inline-flex align-items-center gap-2"><i class="fa fa-fw fa-pencil text-muted"></i> [[topic:edit]]</span></a>
						</li>
						<li>
							<a href="#" class="dropdown-item rounded-1" data-action="delete" role="menuitem"><span class="d-inline-flex align-items-center gap-2"><i class="fa fa-fw fa-trash text-muted"></i> [[topic:delete]]</span></a>
						</li>
						<li>
							<a href="#" class="dropdown-item rounded-1" data-action="restore" role="menuitem"><span class="d-inline-flex align-items-center gap-2"><i class="fa fa-fw fa-repeat text-muted"></i> [[topic:restore]]</span></a>
						</li>
						{{{ end }}}

						{{{ if (isAdminOrGlobalMod || isOwner )}}}
						<li>
							<a href="#" class="dropdown-item rounded-1" data-action="pin" role="menuitem"><span class="d-inline-flex align-items-center gap-2"><i class="fa fa-fw fa-thumbtack text-muted"></i> [[modules:chat.pin-message]]</span></a>
						</li>
						<li>
							<a href="#" class="dropdown-item rounded-1" data-action="unpin" role="menuitem"><span class="d-inline-flex align-items-center gap-2"><i class="fa fa-fw fa-thumbtack fa-rotate-90 text-muted"></i> [[modules:chat.unpin-message]]</span></a>
						</li>
						<li class="dropdown-divider"></li>
						{{{ end }}}

						{{{ if isAdminOrGlobalMod }}}
						<li>
							<a href="#" class="dropdown-item rounded-1 chat-ip-button" role="menuitem">
								<span class="d-inline-flex align-items-center gap-2 show"><i class="fa fa-fw fa-info-circle text-muted"></i> [[modules:chat.show-ip]]</span>
								<span class="d-inline-flex align-items-center gap-2 copy hidden"><i class="fa fa-fw fa-copy text-muted"></i> <span class="copy-ip-text"></span></span>
							</a>
						</li>
						{{{ end }}}

						<li>
							<a href="#" class="dropdown-item rounded-1" data-action="copy-text" data-mid="{messages.mid}" role="menuitem"><span class="d-inline-flex align-items-center gap-2"><i class="fa fa-fw fa-copy text-muted"></i> [[modules:chat.copy-text]]</span></a>
						</li>

						<li>
							<a href="#" class="dropdown-item rounded-1" data-action="copy-link" data-mid="{messages.mid}" role="menuitem"><span class="d-inline-flex align-items-center gap-2"><i class="fa fa-fw fa-link text-muted"></i> [[modules:chat.copy-link]]</span></a>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
</li>
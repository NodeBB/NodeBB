<div class="d-flex gap-1 align-items-stretch">
	<!-- search -->
	<button class="btn btn-ghost btn-sm" component="chat/room/search/toggle" data-manual-tooltip="1" title="[[global:header.search]]">
		<i class="fa fa-search text-muted"></i>
	</button>
	<div component="chat/room/search/container" class="position-relative hidden align-self-center">
		<input component="chat/room/search" class="form-control form-control-sm" placeholder="[[search:type-to-search]]" style="width: 150px;">
		<a component="chat/room/search/clear" href="#" class="hidden px-2 py-1 position-absolute top-50 end-0 translate-middle-y">
			<i class="fa fa-times text-muted opacity-75"></i>
		</a>
	</div>


	<!-- notification dropdown -->
	<div class="dropdown d-flex" data-manual-tooltip="1" title="[[modules:chat.notification-settings]]" component="chat/notification/setting">
		<button class="btn btn-ghost btn-sm position-relative" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
			<i class="fa fa-bell text-muted"></i>
			<span class="position-absolute top-0 end-0 text-xs text-muted opacity-50" style="font-size: 10px!important; padding: 1px; line-height: 10px;">
				<i component="chat/notification/setting/icon" class="fa {notificationOptionsIcon}"></i>
			</span>
		</button>
		<ul class="dropdown-menu dropdown-menu-end p-1 text-sm" role="menu">
			{{{ each notificationOptions }}}
			<li>
				<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" href="#" data-value="{./value}" data-icon="{./icon}" role="menuitem">
					<div class="d-flex flex-column gap-1">
						<div class="d-flex align-items-center gap-2">
							<div class="flex-grow-1">{./label}</div>
							<i class="flex-shrink-0 fa fa-fw fa-check {{{ if !./selected }}}hidden{{{ end }}}"></i>
						</div>
						{{{ if @first}}}
						<div component="chat/notification/setting/sub-label" class="text-sm text-muted">{./subLabel}</div>
						{{{ end }}}
					</div>
				</a>
			</li>

			{{{ if @first }}}
			<li><hr class="dropdown-divider"></li>
			{{{ end }}}
			{{{ end }}}
		</ul>
	</div>

	<!-- pinned messages -->
	<button component="chat/pinned/messages/btn" class="btn btn-ghost btn-sm d-none d-lg-block flex-nowrap" title="[[modules:chat.pinned-messages]]" data-bs-toggle="tooltip" data-bs-placement="bottom">
		<i class="fa fa-thumb-tack text-muted"></i>
	</button>

	<!-- manage/options dropdown -->
	<div class="dropdown d-flex" data-manual-tooltip="1" title="[[modules:chat.options]]">
		<button component="chat/controlsToggle" class="btn btn-ghost btn-sm" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
			<i class="fa fa-gear text-muted"></i>
		</button>
		<ul class="dropdown-menu dropdown-menu-end p-1 text-sm" component="chat/controls" role="menu">
			<li>
				<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" href="#" data-action="manage" role="menuitem">
					<i class="fa fa-fw text-muted fa-cog"></i> [[modules:chat.manage-room]]
				</a>
			</li>
			{{{ if isOwner }}}
			<li>
				<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" href="#" data-action="rename" role="menuitem">
					<i class="fa fa-fw text-muted fa-edit"></i> [[modules:chat.rename-room]]
				</a>
			</li>
			{{{ end }}}
			<li>
				<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" href="#" data-action="leave" role="menuitem">
					<i class="fa fa-fw text-muted fa-sign-out"></i> [[modules:chat.leave-room]]
				</a>
			</li>
			{{{ if (public && isAdmin) }}}
			<li>
				<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" href="#" data-action="delete" role="menuitem">
					<i class="fa fa-fw text-danger fa-trash"></i> [[modules:chat.delete-room]]
				</a>
			</li>
			{{{ end }}}
		</ul>
	</div>

	<!-- users toggle -->
	{{{ if users.length }}}
	<div component="chat/user/list/btn" class="btn btn-ghost btn-sm d-none d-lg-flex flex-nowrap align-items-center gap-2" title="[[modules:chat.view-users-list]]" data-bs-toggle="tooltip" data-bs-placement="bottom">
		<div class="d-flex text-nowrap">
			{{{ if ./users.0 }}}
			<span style="width: 18px; z-index: 3;" class="text-decoration-none" href="{config.relative_path}/user/{./users.0.userslug}">{buildAvatar(./users.0, "24px", true)}</span>
			{{{ end }}}
			{{{ if ./users.1 }}}
			<span style="width: 18px; z-index: 2;" class="text-decoration-none" href="{config.relative_path}/user/{./users.1.userslug}">{buildAvatar(./users.1, "24px", true)}</span>
			{{{ end }}}
			{{{ if ./users.2 }}}
			<span style="width: 24px; z-index: 1;" class="text-decoration-none" href="{config.relative_path}/user/{./users.2.userslug}">{buildAvatar(./users.2, "24px", true)}</span>
			{{{ end }}}
		</div>
		{formattedNumber(./userCount)}
	</div>
	{{{ end }}}
</div>

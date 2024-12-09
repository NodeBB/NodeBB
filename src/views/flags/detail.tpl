<!-- IMPORT partials/breadcrumbs.tpl -->

<div class="d-flex flex-column flex-md-row">
	<div class="flex-shrink-0 d-flex flex-column gap-3 border-end-md text-sm mb-3 pe-4" style="flex-basis: 240px !important;">
		<div class="d-grid gap-1">
			<a class="btn btn-ghost btn-sm ff-secondary border d-flex gap-2 align-items-center" href="{config.relative_path}/{type_path}/{targetId}">
				<i class="fa fa-fw fa-external-link text-primary"></i>
				[[flags:go-to-target]]
			</a>

			{{{ if target.uid }}}
			<div class="btn-group dropend" data-uid="{target.uid}">
				<button type="button" class="btn btn-ghost btn-sm ff-secondary border d-flex gap-2 align-items-center dropdown-toggle" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
					<i class="fa fa-fw fa-street-view text-primary"></i>
					[[flags:flagged-user]]
					<i class="fa fa-chevron-right ms-auto text-secondary"></i>
				</button>
				<ul class="dropdown-menu p-1 text-sm" role="menu">
					<li><a class="dropdown-item rounded-1" href="{config.relative_path}/uid/{target.uid}" role="menuitem">[[flags:view-profile]]</a></li>
					{{{ if !config.disableChat }}}
						<li><a class="dropdown-item rounded-1" href="#" data-action="chat" role="menuitem">[[flags:start-new-chat]]</a></li>
					{{{ end }}}
					<li class="dropdown-divider"></li>
					{{{ if privileges.ban }}}
					<li class="{{{ if target.user.banned }}}hidden{{{ end }}}"><a class="dropdown-item rounded-1" href="#" data-action="ban" role="menuitem">[[user:ban-account]]</a></li>
					<li class="{{{ if !target.user.banned }}}hidden{{{ end }}}"><a class="dropdown-item rounded-1" href="#" data-action="unban" role="menuitem">[[user:unban-account]]</a></li>
					{{{ end }}}
					{{{ if privileges.mute}}}
					<li class="{{{ if target.user.muted }}}hidden{{{ end }}}"><a class="dropdown-item rounded-1" href="#" data-action="mute" role="menuitem">[[user:mute-account]]</a></li>
					<li class="{{{ if !target.user.muted }}}hidden{{{ end }}}"><a class="dropdown-item rounded-1" href="#" data-action="unmute" role="menuitem">[[user:unmute-account]]</a></li>
					{{{ end }}}
					{{{ if privileges.admin:users }}}
					<li><a class="dropdown-item rounded-1" href="#" data-action="delete-account" role="menuitem">[[user:delete-account-as-admin]]</a></li>
					<li><a class="dropdown-item rounded-1" href="#" data-action="delete-content" role="menuitem">[[user:delete-content]]</a></li>
					<li><a class="dropdown-item rounded-1" href="#" data-action="delete-all" role="menuitem">[[user:delete-all]]</a></li>
					{{{ end }}}
				</ul>
			</div>
			{{{ end }}}

			<a class="btn btn-ghost btn-sm ff-secondary border d-flex gap-2 align-items-center" href="#" data-action="assign">
				<i class="fa fa-fw fa-id-card-o text-primary"></i>
				[[flags:assign-to-me]]
			</a>

			{{{ if type_bool.post }}}
			{{{ if !target.deleted}}}
			<a class="d-flex gap-2 align-items-center btn btn-sm btn-outline-danger border border-secondary-subtle text-start" href="#" data-action="delete-post"><i class="fa fa-fw fa-trash"></i> [[flags:delete-post]]</a>
			{{{ else }}}
			<a class="d-flex gap-2 align-items-center btn btn-sm btn-danger border border-secondary-subtle text-start" href="#" data-action="purge-post"><i class="fa fa-fw fa-trash"></i> [[flags:purge-post]]</a>
			<a class="d-flex gap-2 align-items-center btn btn-sm btn-outline-success border border-secondary-subtle text-start" href="#" data-action="restore-post"><i class="fa fa-fw fa-reply"></i><i class="fa fa-trash"></i> [[flags:restore-post]]</a>
			{{{ end }}}
			{{{ end }}}
		</div>

		<form class="d-flex flex-column gap-3" id="attributes">
			<div>
				<label class="text-muted fw-semibold" for="state">[[flags:state]]</label>
				<select class="form-select form-select-sm" id="state" name="state" disabled>
					<option value="open">[[flags:state-open]]</option>
					<option value="wip">[[flags:state-wip]]</option>
					<option value="resolved">[[flags:state-resolved]]</option>
					<option value="rejected">[[flags:state-rejected]]</option>
				</select>
			</div>
			<div>
				<label class="text-muted fw-semibold" for="assignee">[[flags:assignee]]</label>
				<select class="form-control form-control-sm" id="assignee" name="assignee" disabled>
					<option value="">[[flags:no-assignee]]</option>
					{{{each assignees}}}
					<option value="{../uid}">{../username}</option>
					{{{end}}}
				</select>
			</div>
			<div class="d-grid">
				<button type="button" class="btn btn-primary" data-action="update">[[flags:update]]</button>
			</div>
		</form>

		<div class="overflow-auto" component="flag/history" style="max-height: 30rem;">
			<h2 class="h6 fw-bold">[[flags:history]]</h2>
			{{{ if !history.length }}}
			<div class="alert alert-success text-center">[[flags:no-history]]</div>
			{{{ end }}}
			{{{ each history }}}
			<div class="d-flex flex-column gap-1">
				<div class="d-flex gap-2 align-items-center">
					<a class="d-flex text-decoration-none" href="{config.relative_path}/user/{./user.userslug}">{buildAvatar(./user, "16px", true)}</a>
					<a href="{config.relative_path}/user/{./user.userslug}">{./user.username}</a>
					<span class="timeago text-muted text-nowrap" title="{./datetimeISO}"></span>
				</div>
				<div>
					<ul class="list-unstyled">
						{{{ each ./fields }}}
						<li>
							[[flags:{@key}]]{{{ if @value }}} &rarr; <span class="fw-semibold">{@value}</span>{{{ end }}}
						</li>
						{{{ end }}}
						{{{ each ./meta }}}
						<li>
							{{./key}}{{{ if ./value }}} &rarr; <span class="fw-semibold">{./value}</span>{{{ end }}}
						</li>
						{{{ end }}}
					</ul>
				</div>
			</div>
			{{{ end }}}
		</div>
	</div>
	<div class="flex-grow-1 ps-md-2 ps-lg-5" style="min-width:0;">
		<div class="d-flex flex-column gap-4">
			<h2 class="h6 fw-bold">
				{target_readable}
			</h2>
			<div component="flag/content" class="d-flex flex-column gap-1 pb-3 border-bottom">
				{{{ if type_bool.post }}}
				<div class="d-flex gap-2 align-items-center">
					<a class="d-flex text-decoration-none" href="{config.relative_path}/user/{target.user.userslug}">{buildAvatar(target.user, "16px", true)}</a>
					<a href="{config.relative_path}/user/{target.user.userslug}">{target.user.username}</a>
					<span class="timeago text-muted" title="{target.timestampISO}"></span>
				</div>
				<blockquote>{target.content}</blockquote>
				{{{ end }}}

				{{{ if type_bool.user }}}
				<div class="d-flex gap-2 align-items-center lh-1 mb-2">
					<a href="{config.relative_path}/user/{./target.userslug}">{buildAvatar(target, "16px", true)}</a>
					<a href="{config.relative_path}/user/{./target.userslug}">{target.username}</a>
				</div>
				<blockquote>{{{ if target.aboutme }}}{target.aboutme}{{{ else }}}<em>[[flags:target-aboutme-empty]]</em>{{{ end }}}</blockquote>
				{{{ end }}}

				{{{ if type_bool.empty }}}
				<div class="alert alert-warning" role="alert">[[flags:target-purged]]</div>
				{{{ end }}}
			</div>
			<div class="flag/reports" class="pb-4 border-bottom">
				<h2 class="h6 fw-bold">[[flags:reports]]</h2>
				<ul class="list-unstyled mt-4">
					{{{ each reports }}}
					<li class="d-flex flex-column gap-1" component="flag/report" data-timestamp="{./timestamp}">
						<div class="d-flex gap-2 align-items-center">
							<a class="d-flex text-decoration-none" href="{config.relative_path}/user/{./reporter.userslug}">{buildAvatar(./reporter, "16px", true)}</a>
							<a href="{config.relative_path}/user/{./reporter.userslug}">{./reporter.username}</a>
							<span class="timeago text-muted" title="{./timestampISO}"></span>
						</div>
						<p>{./value}</p>
					</li>
					{{{ end }}}
				</ul>
			</div>
			<div class="pb-4 border-bottom">
				<div class="d-flex align-items-center">
					<h2 class="h6 fw-bold me-auto mb-0">[[flags:notes]]</h2>
					<button class="btn btn-ghost ff-secondary border" data-action="addEditNote">[[flags:add-note]]</button>
				</div>
				<ul component="flag/notes" class="list-unstyled mt-4">
					{{{ if !notes.length }}}
					<em>[[flags:no-notes]]</em>
					{{{ end }}}
					{{{ each notes }}}
					<li class="d-flex flex-column gap-1" component="flag/note" data-datetime="{./datetime}" data-index="{@index}">
						<div class="d-flex gap-2 align-items-center">
							<a href="{config.relative_path}/user/{./user.userslug}">{buildAvatar(./user, "16px", true)}</a>
							<a href="{config.relative_path}/user/{./user.userslug}">{./user.username}</a>
							<span class="timeago text-muted" title="{./datetimeISO}"></span>
							<div class=" ms-auto flex-shrink-0">
								<a href="#" class="btn btn-sm btn-link" data-action="addEditNote"><i class="fa fa-pencil"></i></a>
								<a href="#" class="btn btn-sm btn-link" data-action="delete-note"><i class="fa fa-trash text-danger"></i></a>
							</div>
						</div>
						<p>{./content}</p>
					</li>
					{{{ end }}}
				</ul>
			</div>
		</div>
	</div>
</div>

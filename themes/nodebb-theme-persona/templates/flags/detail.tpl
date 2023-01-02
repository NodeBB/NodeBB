<!-- IMPORT partials/breadcrumbs.tpl -->

<div class="row">
	<div class="col-sm-12">
		<h2 class="h4">
			{target_readable}
			<small><span class="timeago" title="{datetimeISO}"></span></small>
		</h2>

		<hr />

		<!-- IF type_bool.post -->
		<div class="media">
			<div class="media-left">
				<a href="{config.relative_path}/user/{target.user.userslug}">{buildAvatar(target.user, "lg", false, "media-object")}</a>
			</div>
			<div class="media-body">
				<h4 class="media-heading"><a href="{config.relative_path}/user/{target.user.userslug}">{target.user.username}</a></h4>
				{target.content}
			</div>
		</div>
		<!-- ENDIF type_bool.post -->

		<!-- IF type_bool.user -->
		<div class="media">
			<div class="media-left">
				<a href="{config.relative_path}/user/{target.userslug}">{buildAvatar(target, "lg", false, "media-object")}</a>
			</div>
			<div class="media-body">
				<h4 class="media-heading"><a href="{config.relative_path}/user/{target.userslug}">{target.username}</a></h4>
				<p class="lead">
					<a href="{config.relative_path}/uid/{target.uid}">[[flags:user-view]]</a> |
					<a href="{config.relative_path}/uid/{target.uid}/edit">[[flags:user-edit]]</a>
				</p>
			</div>
		</div>
		<!-- ENDIF type_bool.user -->

		<!-- IF type_bool.empty -->
		<div class="alert alert-warning">[[flags:target-purged]]</div>
		<!-- ENDIF type_bool.empty -->

		<hr />

		<div class="row">
			<div class="col-sm-6">
				<form role="form" id="attributes">
					<div class="form-group">
						<h2 class="h4">[[flags:reports]]</h2>
						<ul class="list-group" component="flag/reports">
							{{{ each reports }}}
							<li class="list-group-item">
								<a href="{config.relative_path}/user/{./reporter.userslug}">{buildAvatar(./reporter, "sm", false)}</a>
								&ndash; <span class="timeago" title="{./timestampISO}"></span>
								<blockquote><em>{./value}</em></blockquote>
							</li>
							{{{ end }}}
						</ul>
					</div>
					<div class="form-group">
						<h2 class="h4" for="state">[[flags:state]]</h2>
						<select class="form-control" id="state" name="state" disabled>
							<option value="open">[[flags:state-open]]</option>
							<option value="wip">[[flags:state-wip]]</option>
							<option value="resolved">[[flags:state-resolved]]</option>
							<option value="rejected">[[flags:state-rejected]]</option>
						</select>
					</div>
					<div class="form-group">
						<h2 class="h4" for="assignee">[[flags:assignee]]</h2>
						<select class="form-control" id="assignee" name="assignee" disabled>
							<option value="">[[flags:no-assignee]]</option>
							{{{each assignees}}}
							<option value="{../uid}">{../username}</option>
							{{{end}}}
						</select>
					</div>
					<button type="button" class="btn btn-block btn-primary" data-action="update">[[flags:update]]</button>
				</form>

				<hr />

				<form role="form">
					<div class="form-group">
						<h2 class="h4" for="note">[[flags:notes]]</h2>
						<textarea id="note" class="form-control"></textarea>
						<button type="button" class="btn btn-block btn-primary" data-action="appendNote">[[flags:add-note]]</button>
					</div>
				</form>

				<div component="flag/notes">
					<!-- IF !notes.length -->
					<div class="alert alert-success text-center">[[flags:no-notes]]</div>
					<!-- ENDIF !notes.length -->
					{{{each notes}}}
					<div class="media" data-datetime="{../datetime}" data-index="{@index}">
						<div class="media-left">
							<a href="{config.relative_path}/user/{../user.userslug}">{buildAvatar(notes.user, "md", false, "media-object")}</a>
						</div>
						<div class="media-body">
							<h4 class="media-heading">
								<a href="{config.relative_path}/user/{../user.userslug}">{../user.username}</a>
								<small><span class="timeago" title="{../datetimeISO}"></span></small>
							</h4>
							{../content}
						</div>
						<div class="media-right">
							<a href="#" data-action="prepare-edit"><i class="fa fa-pencil"></i></a>
							<a href="#" data-action="delete-note"><i class="fa fa-trash text-danger"></i></a>
						</div>
					</div>
					{{{end}}}
				</div>
			</div>
			<div class="col-sm-6">
				<h2 class="h4">[[flags:quick-actions]]</h2>

				<a class="btn btn-default btn-block" href="{config.relative_path}/{type_path}/{targetId}">
					<i class="fa fa-external-link"></i>
					[[flags:go-to-target]]
				</a>

				<a class="btn btn-default btn-block" href="#" data-action="assign">
					<i class="fa fa-id-card-o"></i>
					[[flags:assign-to-me]]
				</a>

				{{{ if type_bool.post }}}
				{{{ if !target.deleted}}}
				<a class="btn btn-danger btn-block" href="#" data-action="delete-post"><i class="fa fa-trash"></i> [[flags:delete-post]]</a>
				{{{ else }}}
				<a class="btn btn-danger btn-block" href="#" data-action="purge-post"><i class="fa fa-trash"></i> [[flags:purge-post]]</a>
				<a class="btn btn-success btn-block" href="#" data-action="restore-post"><i class="fa fa-reply"></i><i class="fa fa-trash"></i> [[flags:restore-post]]</a>
				{{{ end }}}
				{{{ end }}}

				{{{ if target.uid }}}
				<div class="btn-group btn-block" data-uid="{target.uid}">
					<button type="button" class="btn btn-default btn-block dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
						<i class="fa fa-street-view"></i>
						[[flags:flagged-user]]
						<span class="caret"></span>
					</button>
					<ul class="dropdown-menu">
						<li><a href="{config.relative_path}/uid/{target.uid}">[[flags:view-profile]]</a></li>
						{{{ if !config.disableChat }}}
							<li><a href="#" data-action="chat">[[flags:start-new-chat]]</a></li>
						{{{ end }}}
						<li role="separator" class="divider"></li>
						{{{ if privileges.ban }}}
						<li class="{{{ if target.user.banned }}}hidden{{{ end }}}"><a href="#" data-action="ban">[[user:ban_account]]</a></li>
						<li class="{{{ if !target.user.banned }}}hidden{{{ end }}}"><a href="#" data-action="unban">[[user:unban_account]]</a></li>
						{{{ end }}}
						{{{ if privileges.mute}}}
						<li class="{{{ if target.user.muted }}}hidden{{{ end }}}"><a href="#" data-action="mute">[[user:mute_account]]</a></li>
						<li class="{{{ if !target.user.muted }}}hidden{{{ end }}}"><a href="#" data-action="unmute">[[user:unmute_account]]</a></li>
						{{{ end }}}
						{{{ if privileges.admin:users }}}
						<li><a href="#" data-action="delete-account">[[user:delete_account_as_admin]]</a></li>
						<li><a href="#" data-action="delete-content">[[user:delete_content]]</a></li>
						<li><a href="#" data-action="delete-all">[[user:delete_all]]</a></li>
						{{{ end }}}
					</ul>
				</div>
				{{{ end }}}

				<hr />

				<h2 class="h4">[[flags:history]]</h2>
				<div component="flag/history">
					<!-- IF !history.length -->
					<div class="alert alert-success text-center">[[flags:no-history]]</div>
					<!-- ENDIF !history.length -->
					{{{each history}}}
					<div class="media">
						<div class="media-left">
							<a href="{config.relative_path}/user/{../user.userslug}">{buildAvatar(history.user, "md", false, "media-object")}</a>
						</div>
						<div class="media-body">
							<h4 class="media-heading">
								<a href="{config.relative_path}/user/{../user.userslug}">{../user.username}</a>
								<small><span class="timeago" title="{../datetimeISO}"></span></small>
							</h4>
							<ul>
								{{{each ./fields}}}
								<li>
									<span class="label label-primary">[[flags:{@key}]]</span><!-- IF @value --> &rarr; <span class="label label-default">{@value}</span><!-- ENDIF @value -->
								</li>
								{{{end}}}
								{{{ each ./meta }}}
								<li>
									<span class="label label-{{./labelClass}}">{{./key}}</span>{{{ if ./value }}} &rarr; <span class="label label-default">{{ ./value }}</span>{{{ end }}}
								</li>
								{{{ end }}}
							</ul>
						</div>
					</div>
					{{{end}}}
				</div>
			</div>
		</div>
	</div>
</div>

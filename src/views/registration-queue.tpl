<div class="flex-fill">
	<ul class="nav nav-tabs mb-3" role="tablist">
		<li class="nav-item" role="presentation">
			<button
				class="nav-link active fw-semibold"
				id="registration-queue-tab"
				data-bs-toggle="tab"
				data-bs-target="#registration-queue-pane"
				type="button"
				role="tab"
				aria-controls="registration-queue-pane"
				aria-selected="true"
			>
				[[registration-queue:queue]]
			</button>
		</li>

		<li class="nav-item" role="presentation">
			<button
				class="nav-link fw-semibold"
				id="invitations-tab"
				data-bs-toggle="tab"
				data-bs-target="#invitations-pane"
				type="button"
				role="tab"
				aria-controls="invitations-pane"
				aria-selected="false"
			>
				[[registration-queue:invitations]]
			</button>
		</li>
	</ul>

	<div class="tab-content">
		<div
			class="tab-pane fade show active"
			id="registration-queue-pane"
			role="tabpanel"
			aria-labelledby="registration-queue-tab"
			tabindex="0"
		>
			<div class="text-end">
				<button data-action="reject-all" class="btn btn-sm btn-light ff-secondary">[[registration-queue:reject-all]]</button>
			</div>
			<div class="registration mb-3">
				{{{ if !users.length }}}
				<p class="">
					[[registration-queue:description, {config.relative_path}/admin/settings/user#user-registration]]
				</p>
				{{{ end }}}
				<div class="table-responsive">
					<table class="table table-sm text-sm users-list">
						<thead>
							<tr>
								<th>[[registration-queue:list.name]]</th>
								<th>[[registration-queue:list.email]]</th>
								<th class="hidden-xs">[[registration-queue:list.ip]]</th>
								<th class="hidden-xs">[[registration-queue:list.time]]</th>
								{{{ each customHeaders }}}
								<th class="hidden-xs">{./label}</th>
								{{{ end }}}
								<th></th>
							</tr>
						</thead>
						<tbody>
							{{{ each users }}}
							<tr data-username="{./username}" class="align-middle">
								<td>
									{{{ if ./usernameSpam }}}
									<i class="fa fa-times-circle text-danger" title="[[registration-queue:list.username-spam, {./spamData.username.frequency}, {./spamData.username.appears}, {./spamData.username.confidence}]]" data-bs-toggle="tooltip" data-bs-html="true"></i>
									{{{ else }}}
									{{{ if ./spamChecked }}}
									<i class="fa fa-check text-success"></i>
									{{{ end }}}
									{{{ end }}}
									{./username}
									{{{ if ./sso }}}
									<i class="{./sso.icon}" title="{./sso.name}"></i>
									{{{ end }}}
								</td>
								<td>
									{{{ if ./emailSpam }}}
									<i class="fa fa-times-circle text-danger" title="[[registration-queue:list.email-spam, {./spamData.email.frequency}, {./spamData.email.appears}, {./spamData.email.confidence}]]" data-bs-toggle="tooltip" data-bs-html="true"></i>
									{{{ else }}}
									{{{ if ./spamChecked }}}
									<i class="fa fa-check text-success"></i>
									{{{ end }}}
									{{{ end }}}
									{./email}
								</td>
								<td class="hidden-xs">
									<div class="d-flex gap-2 align-items-center">
										{{{ if ./ipSpam }}}
										<i class="fa fa-times-circle text-danger" title="[[registration-queue:list.ip-spam, {./spamData.ip.frequency}, {./spamData.ip.appears}, {./spamData.ip.confidence}]]" data-bs-toggle="tooltip" data-bs-html="true"></i>
										{{{ else }}}
										{{{ if ./spamChecked }}}
										<i class="fa fa-check text-success"></i>
										{{{ end }}}
										{{{ end }}}
										{./ip}
										{{{ if ./ipMatch.length }}}
										<div class="dropdown position-static">
											<button type="button" class="btn btn-ghost btn-sm dropdown-toggle border" data-bs-toggle="dropdown" aria-expanded="false">{./ipMatch.length} <i class="fa-solid fa-users"></i></button>
											<ul class="dropdown-menu p-1 overflow-auto" style="max-height:300px;">
												{{{ each ./ipMatch}}}
												<li class="d-flex gap-1 align-items-center">
													<a href="{config.relative_path}/uid/{./uid}" class="dropdown-item rounded-1">{{buildAvatar(@value, "24px", true)}} {./username}</a>
												</li>
												{{{ end }}}
											</ul>
										</div>
										{{{ end }}}
									</div>
								</td>
								<td class="hidden-xs">
									<span class="timeago" title="{./timestampISO}"></span>
								</td>

								{{{ each ./customRows }}}
								<td class="hidden-xs">{./value}</td>
								{{{ end }}}

								<td>
									<div class="d-flex gap-1 justify-content-end">
										<button class="btn btn-light btn-sm" data-action="accept"><i class="fa fa-check text-success"></i></button>
										<button class="btn btn-light btn-sm" data-action="delete"><i class="fa fa-trash text-danger"></i></button>
										{{{ each ./customActions }}}
										<button id="{./id}" title="{./title}" class="btn btn-sm {./class}">
											<i class="fa {./icon}"></i>
										</button>
										{{{ end }}}
									</div>
								</td>
							</tr>
							{{{ end }}}
						</tbody>
					</table>
				</div>

				<!-- IMPORT admin/partials/paginator.tpl -->
			</div>
		</div>
	</div>

	<div class="tab-content">
		<div
			class="tab-pane fade"
			id="invitations-pane"
			role="tabpanel"
			aria-labelledby="invitations-tab"
			tabindex="0"
		>
			<div class="invitations">
				<p class="">
					[[registration-queue:invitations.description]]
				</p>
				<div class="table-responsive">
					<table class="table table-sm text-sm invites-list">
						<thead>
							<tr>
								<th>[[registration-queue:invitations.inviter-username]]</th>
								<th>[[registration-queue:invitations.invitee-email]]</th>
								<th>[[registration-queue:invitations.invitee-username]]</th>
							</tr>
						</thead>
						<tbody>
							{{{ each invites }}}
							{{{ each invites.invitations }}}
							<tr data-invitation-mail="{invites.invitations.email}" data-invited-by="{invites.username}" class="align-middle">
								<td class ="invited-by">{{{ if @first }}}{invites.username}{{{ end }}}</td>
								<td>{invites.invitations.email}</td>
								<td>
									<div class="d-flex gap-2 align-items-center">
										{invites.invitations.username}
										<div class="d-flex justify-content-end ms-auto">
											<button class="btn btn-danger btn-sm" data-action="delete"><i class="fa fa-times"></i></button>
										</div>
									</div>
								</td>
							</tr>
							{{{ end }}}
							{{{ end }}}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
</div>

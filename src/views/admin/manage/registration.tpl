<div class="row px-lg-4">
	<div class="col-12">
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
					[[admin/manage/registration:queue]]
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
					[[admin/manage/registration:invitations]]
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
				<div class="registration card mb-3">
					{{{ if !users.length }}}
					<p class="card-body">
						[[admin/manage/registration:description, {config.relative_path}/admin/settings/user#user-registration]]
					</p>
					{{{ end }}}
					<div class="table-responsive">
						<table class="table users-list">
							<thead>
								<tr>
									<th>[[admin/manage/registration:list.name]]</th>
									<th>[[admin/manage/registration:list.email]]</th>
									<th class="hidden-xs">[[admin/manage/registration:list.ip]]</th>
									<th class="hidden-xs">[[admin/manage/registration:list.time]]</th>
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
										<i class="fa fa-times-circle text-danger" title="[[admin/manage/registration:list.username-spam, {./spamData.username.frequency}, {./spamData.username.appears}, {./spamData.username.confidence}]]"></i>
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
										<i class="fa fa-times-circle text-danger" title="[[admin/manage/registration:list.email-spam, {./spamData.email.frequency}, {./spamData.email.appears}]]"></i>
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
											<i class="fa fa-times-circle text-danger" title="[[admin/manage/registration:list.ip-spam, {./spamData.ip.frequency}, {./spamData.ip.appears}]]"></i>
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
											<button class="btn btn-success btn-sm" data-action="accept"><i class="fa fa-check"></i></button>
											<button class="btn btn-danger btn-sm" data-action="delete"><i class="fa fa-times"></i></button>
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
				<div class="invitations card">
					<p class="card-body">
						[[admin/manage/registration:invitations.description]]
					</p>
					<div class="table-responsive">
						<table class="table invites-list">
							<thead>
								<tr>
									<th>[[admin/manage/registration:invitations.inviter-username]]</th>
									<th>[[admin/manage/registration:invitations.invitee-email]]</th>
									<th>[[admin/manage/registration:invitations.invitee-username]]</th>
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
											<div class="d-flex justify-content-end">
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
</div>

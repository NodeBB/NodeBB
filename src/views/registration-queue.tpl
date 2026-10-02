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
				{{tx("registration-queue:queue")}}
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
				{{tx("registration-queue:invitations")}}
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
			<div class="registration mb-3">
				{{{ if !queueEnabled }}}
				<p>{{tx("registration-queue:description", concat(config.relative_path, "/admin/settings/user#user-registration"))}}</p>
				{{{ end }}}
				{{{ if !users.length }}}
				<p>{{tx("registration-queue:no-users-in-queue")}}</p>
				{{{ end }}}

				{{{ if cleanUsers.length }}}
				<div class="registration-queue-group mb-4" data-group="requests">
					<h3 class="fs-5 mb-2">{{tx("registration-queue:requests")}} <span class="badge text-bg-light">{cleanUsers.length}</span></h3>
					<div class="table-responsive">
						<table class="table table-sm text-sm users-list">
							<!-- IMPORT partials/registration-queue/table-head.tpl -->
							<tbody>
								{{{ each cleanUsers }}}
								<!-- IMPORT partials/registration-queue/user-row.tpl -->
								{{{ end }}}
							</tbody>
						</table>
					</div>
					<div class="d-flex flex-wrap gap-1 justify-content-end mt-2">
						<button data-action="reject-all" class="btn btn-sm btn-light ff-secondary">{{tx("registration-queue:reject-all")}}</button>
						<button data-action="reject-selected" class="btn btn-sm btn-light ff-secondary">{{tx("registration-queue:reject-selected")}}</button>
					</div>
				</div>
				{{{ end }}}

				{{{ if spamUsers.length }}}
				<div class="registration-queue-group mb-4" data-group="spam">
					<h3 class="fs-5 mb-0">{{tx("registration-queue:suspected-spam")}} <span class="badge text-bg-danger">{spamUsers.length}</span></h3>
					<p class="text-muted text-sm">{{tx("registration-queue:suspected-spam-description")}}</p>
					<div class="table-responsive">
						<table class="table table-sm text-sm users-list">
							<!-- IMPORT partials/registration-queue/table-head.tpl -->
							<tbody>
								{{{ each spamUsers }}}
								<!-- IMPORT partials/registration-queue/user-row.tpl -->
								{{{ end }}}
							</tbody>
						</table>
					</div>
					<div class="d-flex flex-wrap gap-1 justify-content-end mt-2">
						{{{ each customBulkActions }}}
						<button id="{./id}" class="btn btn-sm {./class}">
							{{{ if ./icon }}}<i class="fa {./icon}"></i> {{{ end }}}{{tx(./title)}}
						</button>
						{{{ end }}}
						<button data-action="reject-selected" class="btn btn-sm btn-light ff-secondary">{{tx("registration-queue:reject-selected")}}</button>
					</div>
				</div>
				{{{ end }}}

				{{{ if !cleanUsers.length }}}
				{{{ if users.length }}}
				<div class="d-flex justify-content-end mt-2">
					<button data-action="reject-all" class="btn btn-sm btn-light ff-secondary">{{tx("registration-queue:reject-all")}}</button>
				</div>
				{{{ end }}}
				{{{ end }}}

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
					{{tx("registration-queue:invitations.description")}}
				</p>
				<div class="table-responsive">
					<table class="table table-sm text-sm invites-list">
						<thead>
							<tr>
								<th>{{tx("registration-queue:invitations.inviter-username")}}</th>
								<th>{{tx("registration-queue:invitations.invitee-email")}}</th>
								<th>{{tx("registration-queue:invitations.invitee-username")}}</th>
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

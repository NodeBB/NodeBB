<div class="px-lg-4">
	<div component="settings/main/header" class="row d-flex flex-wrap justify-content-between border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center mb-3">
		<div class="col-12 col-md-8 px-0 mb-1 mb-md-0">
			<h4 class="fw-bold tracking-tight mb-0">{{tx(./title)}}</h4>
		</div>
		<div class="col-12 col-md-4 px-0 px-md-3">
			<div class="d-flex gap-1 justify-content-end">
				<button type="button" class="btn btn-sm btn-primary text-nowrap" data-action="create">
					<i class="fa fa-plus"></i>
					{{tx("admin/manage/oauth:create-client")}}
				</button>
			</div>
		</div>
	</div>

	<p class="lead">{{tx("admin/manage/oauth:lead-text")}}</p>
	<p class="text-secondary">{{tx("admin/manage/oauth:intro")}}</p>

	<div class="table-responsive mb-3">
		<table class="table table-sm text-sm" data-component="acp/oauth-clients">
			<thead>
				<tr>
					<th>{{tx("admin/manage/oauth:name")}}</th>
					<th>{{tx("admin/manage/oauth:client-id")}}</th>
					<th>{{tx("admin/manage/oauth:redirect-uris")}}</th>
					<th>{{tx("admin/manage/oauth:grants")}}</th>
					<th>{{tx("admin/manage/oauth:scopes")}}</th>
					<th>{{tx("admin/manage/oauth:type")}}</th>
					<th>{{tx("admin/manage/oauth:created")}}</th>
					<th>{{tx("admin/manage/oauth:actions")}}</th>
				</tr>
			</thead>
			<tbody>
				{{{ each clients }}}
				<tr data-client-id="{./id}">
					<td class="align-middle">
						<strong>{./name}</strong>
						{{{ if ./description }}}
						<div class="text-secondary small">{./description}</div>
						{{{ end }}}
					</td>
					<td class="align-middle"><code>{./id}</code></td>
					<td class="align-middle small">
						{{{ each ./redirectUris }}}
						<div><code>{./}</code></div>
						{{{ end }}}
					</td>
					<td class="align-middle small">
						{{{ each ./grants }}}
						<span class="badge text-bg-secondary">{./}</span>
						{{{ end }}}
					</td>
					<td class="align-middle small">
						{{{ each ./scopes }}}
						<span class="badge text-bg-info">{./}</span>
						{{{ end }}}
					</td>
					<td class="align-middle">
						{{{ if ./public }}}
						<span class="badge text-bg-light border">{{tx("admin/manage/oauth:public")}}</span>
						{{{ else }}}
						<span class="badge text-bg-light border">{{tx("admin/manage/oauth:confidential")}}</span>
						{{{ end }}}
						{{{ if ./disabled }}}
						<span class="badge text-bg-danger">{{tx("admin/manage/oauth:disabled")}}</span>
						{{{ end }}}
					</td>
					<td class="align-middle"><span class="timeago" title="{./createdAtISO}"></span></td>
					<td class="text-nowrap align-middle">
						<button type="button" class="btn btn-light btn-sm" data-action="edit" title="{{tx("admin/manage/oauth:edit")}}">
							<i class="fa fa-edit text-primary"></i>
						</button>
						<button type="button" class="btn btn-light btn-sm" data-action="rotate-secret" title="{{tx("admin/manage/oauth:rotate-secret")}}" {{{ if ./public }}}disabled{{{ end }}}">
							<i class="fa fa-key text-primary"></i>
						</button>
						<button type="button" class="btn btn-light btn-sm" data-action="delete" title="{{tx("admin/manage/oauth:delete")}}">
							<i class="fa fa-trash text-danger"></i>
						</button>
					</td>
				</tr>
				{{{ end }}}
			</tbody>
		</table>
	</div>
	<!-- IMPORT admin/partials/paginator.tpl -->
</div>

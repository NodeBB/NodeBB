<form role="form" class="core-api-settings">
	<p class="lead">[[admin/settings/api:lead-text]]</p>
	<p>[[admin/settings/api:intro]]</p>
	<p class="text-danger">[[admin/settings/api:warning]]</p>
	<p class="d-flex align-items-center">
		<a class="flex-grow-1" href="https://docs.nodebb.org/api">
			<i class="fa fa-external-link"></i>
			[[admin/settings/api:docs]]
		</a>
		<button type="button" class="btn btn-primary float-end" data-action="create">
			<i class="fa fa-plus"></i>
			[[admin/settings/api:create-token]]
		</button>
	</p>

	<table class="table mb-5" data-component="acp/tokens">
		<thead>
			<tr>
				<th>[[admin/settings/api:token]]</th>
				<th>[[admin/settings/api:description]]</th>
				<th>[[admin/settings/api:uid]]</th>
				<th>[[admin/settings/api:last-seen]]</th>
				<th>[[admin/settings/api:created]]</th>
			</tr>
		</thead>
		<tbody>
			{{{ each tokens }}}
			<tr>
				<td>
					<button type="button" class="btn btn-link" data-action="copy" data-clipboard-text="{./token}"><i class="fa fa-fw fa-clipboard" aria-hidden="true"></i></button>
					<div class="vr me-3" aria-hidden="true"></div>
					<span class="user-select-all">{./token}</span>
				</td>
				<td class="align-middle">
					{{{ if ./description }}}
					{./description}
					{{{ else }}}
					<em class="text-secondary">[[admin/settings/api:no-description]]</em>
					{{{ end }}}
				</td>
				<td class="align-middle">
					{{{ if (./uid == "0") }}}
					<em>[[admin/settings/api:master-token]]</em>
					{{{ else }}}
					{./uid}
					{{{ end }}}
				</td>
				<td class="align-middle">
					{{{ if ./lastSeen }}}
					<span class="timeago" title="{./lastSeenISO}"></span>
					{{{ else }}}
					<em class="text-secondary">[[admin/settings/api:last-seen-never]]</em>
					{{{ end }}}
				</td>
				<td class="align-middle">
					<span class="timeago" title="{./timestampISO}"></span>
				</td>
			</tr>
			{{{ end }}}
		</tbody>
	</table>

	<div class="row mb-4">
		<div class="col-sm-2 col-12 settings-header">[[admin/settings/api:settings]]</div>
		<div class="col-sm-10 col-12">
			<div class="form-check form-switch mb-3">
				<input id="requireHttps" class="form-check-input" type="checkbox" name="requireHttps" />
				<label class="form-check-label">[[admin/settings/api:require-https]]</label>
				<p class="form-text">[[admin/settings/api:require-https-caveat]]</p>
			</div>
		</div>
	</div>
</form>

<!-- IMPORT admin/partials/save_button.tpl -->

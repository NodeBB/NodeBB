<div class="d-flex flex-column gap-2 px-lg-4">
	<div component="settings/main/header" class="row border-bottom py-2 m-0 mb-3 sticky-top acp-page-main-header align-items-center">
		<div class="col-12 col-md-8 px-0 mb-1 mb-md-0">
			<h4 class="fw-bold tracking-tight mb-0">{{tx(title)}}</h4>
		</div>
	</div>

	<div class="row">
		<div class="col-12">
			<p>{{tx("admin/settings/activitypub:hashtags.intro")}}</p>

			<div class="mb-4">
				<div class="mb-3 row">
					<div class="col-12 col-md-6">
						<label class="form-label" for="relayHost">{{tx("admin/settings/activitypub:hashtags.relay-host")}}</label>
						<div class="input-group mb-3">
							<select class="form-select" id="relayHost">
								{{{ each relayOptions }}}
								<option value="{@value}"{{{ if (@value == relay) }}} selected{{{ end }}}>{@value}</option>
								{{{ end }}}
							</select>
							<button class="btn btn-sm btn-primary" data-action="hashtags.setRelay">{{tx("admin/settings/activitypub:hashtags.save-relay")}}</button>
						</div>
						<div class="form-text">{{tx("admin/settings/activitypub:hashtags.relay-host-help")}}</div>
						<div class="form-text text-warning">{{tx("admin/settings/activitypub:hashtags.relay-change-warning")}}</div>
					</div>
				</div>
			</div>

			<div class="mb-3 table-responsive">
				<table class="table table-striped" id="hashtags">
					<thead>
						<th>{{tx("admin/settings/activitypub:hashtags.table.tag")}}</th>
						<th>{{tx("admin/settings/activitypub:hashtags.table.state")}}</th>
						<th></th>
					</thead>
					<tbody component="hashtags/list">
						<!-- IMPORT admin/partials/activitypub/hashtags/list.tpl -->
					</tbody>
					<tfoot>
						<tr>
							<td colspan="3">
								<button class="btn btn-sm btn-primary" data-action="hashtags.add">{{tx("admin/settings/activitypub:hashtags.follow")}}</button>
							</td>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
	</div>
</div>

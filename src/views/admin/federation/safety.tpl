<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="denylists" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">{{tx("admin/settings/activitypub:blocklists")}}</h5>
				<div class="mb-3">
					<p>{{tx("admin/settings/activitypub:blocklists-help")}}</p>
					<p class="form-text">{{tx("admin/settings/activitypub:blocklists-default")}}</p>
					<div class="mb-3 table-responsive-md">
						<table class="table table-striped" id="blocklists">
							<thead>
								<th>{{tx("admin/settings/activitypub:blocklists.url")}}</th>
								<th>{{tx("admin/settings/activitypub:blocklists.count")}}</th>
								<th></th>
							</thead>
							<tbody>
								{{{ each blocklists }}}
								<tr data-url="{./url}">
									<td>{./url}</td>
									<td>{./count}</td>
									<td>
										<div class="d-flex gap-3">
											<a href="#" data-action="blocklists.view"><i class="fa fa-list"></i></a>
											<a href="#" data-action="blocklists.refresh"><i class="fa fa-refresh"></i></a>
											<a href="#" data-action="blocklists.remove"><i class="fa fa-trash link-danger"></i></a>
										</div>
									</td>
								</tr>
								{{{ end }}}
							</tbody>
							<tfoot>
								<tr>
									<td colspan="3">
										<button class="btn btn-sm btn-primary" data-action="blocklists.add">{{tx("admin/settings/activitypub:blocklists.add")}}</button>
									</td>
								</tr>
							</tfoot>
						</table>
					</div>
				</div>
			</div>

			<div id="server-filtering" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">{{tx("admin/settings/activitypub:server-filtering")}}</h5>
				<form>
					<div class="mb-3">
						<p>{{tx("admin/settings/activitypub:server.filter-help")}}</p>
						<p>{{tx("admin/settings/activitypub:count", instanceCount)}}</p>
						<div class="mb-3">
							<h6 class="fw-bold">{{tx("admin/settings/activitypub:core-domains.title")}}</h6>
							<div class="input-group mb-2">
								<input type="text" class="form-control" id="coreDomainInput" placeholder="{{tx("admin/settings/activitypub:core-domains.placeholder")}}" />
								<select class="form-select" id="coreSeveritySelect">
									<option value="suspend">{{tx("admin/settings/activitypub:severity.suspend")}}</option>
									<option value="silence">{{tx("admin/settings/activitypub:severity.silence")}}</option>
									<option value="filter">{{tx("admin/settings/activitypub:severity.filter")}}</option>
								</select>
								<button class="btn btn-sm btn-primary" type="button" data-action="core.add">{{tx("admin/settings/activitypub:core-domains.add")}}</button>
							</div>
							<div class="table-responsive">
								<table class="table table-sm table-striped" id="coreDomains">
									<thead>
										<th>{{tx("admin/settings/activitypub:core-domains.domain")}}</th>
										<th>{{tx("admin/settings/activitypub:core-domains.severity")}}</th>
										<th></th>
									</thead>
									<tbody>
										{{{ if !domains.length }}}
										<tr><td colspan="3" class="text-muted">{{tx("admin/settings/activitypub:core-domains.empty")}}</td></tr>
										{{{ else }}}
										{{{ each domains }}}
										<tr data-domain="{./domain}">
											<td>{./domain}</td>
											<td>{{tx(concat("admin/settings/activitypub:severity.", ./severity))}}</td>
											<td><a href="#" data-action="core.remove"><i class="fa fa-trash link-danger"></i></a></td>
										</tr>
										{{{ end }}}
										{{{ end }}}
									</tbody>
								</table>
							</div>
						</div>
					</div>
					<div class="form-check form-switch mb-3">
						<input class="form-check-input" type="checkbox" id="activitypubFilter" data-field="activitypubFilter" />
						<label class="form-check-label" for="activitypubFilter">{{tx("admin/settings/activitypub:server.filter-allow-list")}}</label>
						<p class="form-text">{{tx("admin/settings/activitypub:server.filter-allow-list-help")}}</p>
					</div>
				</form>
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>

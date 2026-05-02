<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="denylists" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/activitypub:blocklists]]</h5>
				<div class="mb-3">
					<p>[[admin/settings/activitypub:blocklists-help]]</p>
					<p class="form-text">[[admin/settings/activitypub:blocklists-default]]</p>
					<div class="mb-3 table-responsive-md">
						<table class="table table-striped" id="blocklists">
							<thead>
								<th>[[admin/settings/activitypub:blocklists.url]]</th>
								<th>[[admin/settings/activitypub:blocklists.count]]</th>
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
										<button class="btn btn-sm btn-primary" data-action="blocklists.add">[[admin/settings/activitypub:blocklists.add]]</button>
									</td>
								</tr>
							</tfoot>
						</table>
					</div>
				</div>
			</div>

			<div id="server-filtering" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/activitypub:server-filtering]]</h5>
				<form>
					<div class="mb-3">
						<p>[[admin/settings/activitypub:server.filter-help]]</p>
						<p>[[admin/settings/activitypub:server.filter-help-hostname]]</p>
						<p>[[admin/settings/activitypub:count, {instanceCount}]]</p>
						<label for="activitypubFilterList" class="form-label">Filtering list</label>
						<textarea class="form-control" id="activitypubFilterList" data-field="activitypubFilterList" rows="10"></textarea>
					</div>
					<div class="form-check form-switch mb-3">
						<input class="form-check-input" type="checkbox" id="activitypubFilter" data-field="activitypubFilter" />
						<label class="form-check-label" for="activitypubFilter">[[admin/settings/activitypub:server.filter-allow-list]]</label>
					</div>
				</form>
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>

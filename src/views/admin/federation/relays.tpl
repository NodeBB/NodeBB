<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="relays" class="mb-4">
				<p class="lead">[[admin/settings/activitypub:relays.intro]]</p>
				<p class="text-warning">[[admin/settings/activitypub:relays.warning]]</p>
				<div class="mb-3">
					<table class="table table-striped" id="relays">
						<thead>
							<th>[[admin/settings/activitypub:relays.relay]]</th>
							<th>[[admin/settings/activitypub:relays.state]]</th>
							<th></th>
						</thead>
						<tbody>
							{{{ each relays }}}
							<tr data-url="{./url}">
								<td>{./url}</td>
								<td>{./label}</td>
								<td><a href="#" data-action="relays.remove"><i class="fa fa-trash link-danger"></i></a></td>
							</tr>
							{{{ end }}}
						</tbody>
						<tfoot>
							<tr>
								<td colspan="3">
									<button class="btn btn-sm btn-primary" data-action="relays.add">[[admin/settings/activitypub:relays.add]]</button>
								</td>
							</tr>
						</tfoot>
					</table>
				</div>
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>

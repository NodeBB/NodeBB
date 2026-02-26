<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="rules" class="mb-4">
				<p class="lead">[[admin/settings/activitypub:rules-intro]]</p>

				<div class="mb-3 table-responsive-md">
					<table class="table table-striped" id="rules">
						<thead>
							<th></th>
							<th>[[admin/settings/activitypub:rules.type]]</th>
							<th>[[admin/settings/activitypub:rules.value]]</th>
							<th>[[admin/settings/activitypub:rules.cid]]</th>
							<th></th>
						</thead>
						<tbody>
							{{{ each rules }}}
							<tr data-rid="{./rid}">
								<td class="align-items-center" style="cursor: move;">
									<i class="fa fa-grip-lines text-muted drag-handle"></i>
								</td>
								<td>{./type}</td>
								<td>{./value}</td>
								<td>{./cid}</td>
								<td><a href="#" data-action="rules.delete"><i class="fa fa-trash link-danger"></i></a></td>
							</tr>
							{{{ end }}}
						</tbody>
						<tfoot>
							<tr>
								<td colspan="5">
									<button class="btn btn-sm btn-primary" data-action="rules.add">[[admin/settings/activitypub:rules.add]]</button>
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

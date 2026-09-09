<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="rules" class="mb-4">
				<p class="lead">{{tx("admin/settings/activitypub:rules-intro")}}</p>

				{{{ if (hasFilterOrRejectRules && !postQueueEnabled) }}}
				<div class="alert alert-warning">{{tx("admin/settings/activitypub:rules.filter-warning")}}</div>
				{{{ end }}}

				<div id="cutoff" class="mb-4">
					<h5 class="fw-bold tracking-tight settings-header">{{tx("admin/settings/activitypub:rules.cutoff.title")}}</h5>
					<form>
						<div class="mb-3">
							<label class="form-label" for="activitypubRulesCutoffDays">{{tx("admin/settings/activitypub:rules.cutoff.label")}}</label>
							<input type="number" id="activitypubRulesCutoffDays" name="activitypubRulesCutoffDays" data-field="activitypubRulesCutoffDays" title="[[admin/settings/activitypub:rules.cutoff.label]]" class="form-control" value="{activitypubRulesCutoffDays}" min="0" />
							<div class="form-text">
								{{tx("admin/settings/activitypub:rules.cutoff.help")}}
							</div>
						</div>
					</form>
				</div>

				<div class="mb-3 table-responsive-md">
					<table class="table table-striped" id="rules">
						<thead>
							<th></th>
							<th>{{tx("admin/settings/activitypub:rules.type")}}</th>
							<th>{{tx("admin/settings/activitypub:rules.value")}}</th>
							<th>{{tx("admin/settings/activitypub:rules.action")}}</th>
							<th>{{tx("admin/settings/activitypub:rules.cid")}}</th>
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
								<td>
									{{{ if (./action == "2") }}}{{tx("admin/settings/activitypub:rules.reject")}}{{{ else }}}
										{{{ if (./action == "1") }}}{{tx("admin/settings/activitypub:rules.filter")}}{{{ else }}}
										{{tx("admin/settings/activitypub:rules.categorize")}}
										{{{ end }}}
									{{{ end }}}
								</td>
								<td>{./cid}</td>
								<td><a href="#" data-action="rules.delete"><i class="fa fa-trash link-danger"></i></a></td>
							</tr>
							{{{ end }}}
						</tbody>
						<tfoot>
							<tr>
								<td colspan="6">
									<button class="btn btn-sm btn-primary" data-action="rules.add">{{tx("admin/settings/activitypub:rules.add")}}</button>
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

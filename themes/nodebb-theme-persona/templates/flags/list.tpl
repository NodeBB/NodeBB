<!-- IMPORT partials/breadcrumbs.tpl -->

<div class="row">
	<div class="col-sm-4 col-md-3">
		<!-- IMPORT partials/flags/filters.tpl -->
	</div>
	<div class="col-sm-8 col-md-9">
		<!-- IF hasFilter -->
		<div class="alert alert-warning">
			<p class="pull-right">
				<a href="{config.relative_path}/flags">[[flags:filter-reset]]</a>
			</p>
			[[flags:filter-active]]
		</div>
		<!-- ENDIF hasFilter -->

		<div class="btn-group pull-right" component="flags/bulk-actions">
			<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" autocomplete="off" aria-haspopup="true" aria-expanded="false" disabled="disabled">
				<i class="fa fa-clone"></i> [[flags:bulk-actions]] <span class="caret"></span>
			</button>
			<ul class="dropdown-menu">
				<li><a href="#" data-action="bulk-assign">[[flags:assign-to-me]]</a></li>
				<li><a href="#" data-action="bulk-mark-resolved">[[flags:bulk-resolve]]</a></li>
			</ul>
		</div>

		<table class="table table-striped table-hover" component="flags/list">
			<thead>
				<tr>
					<th>
						<input type="checkbox" data-action="toggle-all" autocomplete="off" />
					</th>
					<th></th>
					<th><span class="hidden-xs">[[flags:reports]] </span><i class="fa fa-user-plus"></i></th>
					<th><span class="hidden-xs">[[flags:first-reported]] </span><i class="fa fa-clock-o"></i></th>
					<th>[[flags:state]]</th>
				</tr>
			</thead>
			<tbody>
				<!-- IF !flags.length -->
				<tr>
					<td colspan="5">
						<div class="alert alert-success text-center">
							[[flags:no-flags]]
						</div>
					</td>
				</tr>
				<!-- ENDIF !flags.length -->
				{{{each flags}}}
				<tr data-flag-id="{../flagId}">
					<td>
						<input type="checkbox" autocomplete="off" />
					</td>
					<td>
						<a href="{config.relative_path}/flags/{../flagId}">
							<strong>{../target_readable}</strong>
						</a>
					</td>
					<td>
						{./heat}
					</td>
					<td><span class="timeago" title="{../datetimeISO}"></span></td>
					<td><span class="label label-{../labelClass}">[[flags:state-{../state}]]</span></td>
				</tr>
				{{{end}}}
			</tbody>
		</table>

		<!-- IMPORT partials/paginator.tpl -->
	</div>
</div>

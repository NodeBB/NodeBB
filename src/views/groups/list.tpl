<div data-widget-area="header">
	{{{each widgets.header}}}
	{{widgets.header.html}}
	{{{end}}}
</div>
<div class="groups list flex-fill">
	<h3 class="fw-semibold">[[pages:groups]]</h3>
	<div class="d-flex flex-wrap justify-content-between">
		<div class="mb-2 mb-md-0">
			<div class="text-sm d-flex flex-wrap align-items-center gap-2">
				[[topic:sort-by]]
				<div class="d-flex flex-wrap gap-2">
					<a href="?sort=alpha" class="btn btn-ghost btn-sm ff-secondary fw-semibold text-nowrap {{{ if (sort == "alpha") }}}active{{{ end }}}">[[groups:details.group-name]]</a>
					<a href="?sort=count" class="btn btn-ghost btn-sm ff-secondary fw-semibold text-nowrap {{{ if (sort == "count") }}}active{{{ end }}}">[[groups:details.member-count]]</a>
					<a href="?sort=date" class="btn btn-ghost btn-sm ff-secondary fw-semibold text-nowrap {{{ if (sort == "date") }}}active{{{ end }}}">[[groups:details.creation-date]]</a>
				</div>
			</div>
		</div>
		<div>
			<div class="d-flex justify-content-end gap-2">
				<div>
					{{{ if allowGroupCreation }}}
					<button class="btn btn-primary btn-sm text-nowrap" data-action="new"><i class="fa fa-users"></i> [[groups:new-group]]</button>
					{{{ end }}}
					<select class="form-select hidden" id="search-sort">
						<option value="alpha">[[groups:details.group-name]]</option>
						<option value="count">[[groups:details.member-count]]</option>
						<option value="date">[[groups:details.creation-date]]</option>
					</select>
				</div>
				<div>
					<div class="input-group">
						<input type="text" class="form-control form-control-sm" placeholder="[[global:search]]" name="query" id="search-text">
						<button id="search-button" class="btn btn-primary btn-sm" aria-label="[[global:search]]">
							<i class="fa fa-search"></i>
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>

	<hr />

	<div component="groups/container" class="row" id="groups-list">
		{{{ if groups.length }}}
		<!-- IMPORT partials/groups/list.tpl -->
		{{{ else }}}
		<div class="col-12">
			<div class="alert alert-warning">
			[[groups:no-groups-found]]
			</div>
		</div>
		{{{ end }}}
	</div>

	<!-- IMPORT partials/paginator.tpl -->
</div>

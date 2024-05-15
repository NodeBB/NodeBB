<div class="row events px-lg-4">
	<div class="col-lg-9">
		<h5><i class="fa fa-calendar-o"></i> [[admin/advanced/events:events]]</h5>
		{{{ if !events.length }}}
		<div class="alert alert-info">[[admin/advanced/events:no-events]]</div>
		{{{ end }}}
		<div class="events-list">
			{{{ each events }}}
			<div class="card mb-3" data-eid="{events.eid}">
				<div class="card-body">
					<div class="mb-3 d-flex flex-wrap justify-content-between align-items-center gap-1">
						<div>
							<span class="badge bg-primary">#{events.eid}</span>
							<span class="badge bg-info">{events.type}</span>
							<span class="badge bg-info">uid {events.uid}</span>
							{{{ if events.ip }}}<span class="badge bg-info">{events.ip}</span>{{{ end }}}
							<a href="{config.relative_path}/user/{events.user.userslug}" target="_blank">{buildAvatar(events.user, "24px", true)}</a>
							<a href="{config.relative_path}/user/{events.user.userslug}" target="_blank">{events.user.username}</a>
							<span class="text-xs">{events.timestampISO}</span>
						</div>
						<div>
							<button class="btn btn-light btn-sm delete-event ms-2 pointer"><i class="fa fa-trash-o text-danger"></i></button>
						</div>
					</div>
					<pre class="text-bg-light p-3" style="white-space:pre-wrap;">{events.jsonString}</pre>
				</div>
			</div>
			{{{ end }}}
			<!-- IMPORT admin/partials/paginator.tpl -->
		</div>
	</div>
	<div class="col-lg-3 acp-sidebar">
		<div class="card">
			<h5 class="card-header">[[admin/advanced/events:filters]]</h5>
			<div class="card-body">
				<form role="form" id="filters">
					<div class="mb-3">
						<label class="form-label" for="type">[[admin/advanced/events:filter-type]]</label>
						<select id="type" name="type" class="form-select">
							{{{ each types }}}
							<option value="{./value}" {{{ if ./selected }}}selected{{{ end }}}>{./name} - ({./count}) </option>
							{{{ end }}}
						</select>
					</div>
					<div class="mb-3">
						<label class="form-label" for="start">[[admin/advanced/events:filter-start]]</label>
						<input type="date" id="start" name="start" value="{query.start}" class="form-control" />
					</div>
					<div class="mb-3">
						<label class="form-label" for="end">[[admin/advanced/events:filter-end]]</label>
						<input type="date" id="end" name="end" value="{query.end}" class="form-control" />
					</div>
					<div class="mb-3 d-flex flex-column gap-3">
						<select id="user-group-select" class="form-select">
							<option value="username" {{{ if (query.username != "") }}}selected{{{ end }}}>[[admin/advanced/events:filter-user]]</option>
							<option value="group" {{{ if (query.group != "") }}}selected{{{ end }}}>[[admin/advanced/events:filter-group]]</option>
						</select>
						<input type="text" id="username" name="username" value="{query.username}" class="form-control {{{ if (query.group != "") }}}hidden{{{ end }}}" placeholder="[[admin/advanced/events:filter-user.placeholder]]"/>
						<input type="text" id="group" name="group" value="{query.group}" class="form-control {{{ if (query.group == "") }}}hidden{{{ end }}} {{{ if (query.username != "") }}}hidden{{{ end }}}" placeholder="[[admin/advanced/events:filter-group.placeholder]]" />
					</div>
					<div class="mb-3">
						<label class="form-label" for="perPage">[[admin/advanced/events:filter-per-page]]</label>
						<input type="text" id="perPage" name="perPage" value="{query.perPage}" class="form-control" />
					</div>
					<div class="d-grid gap-1">
						<button type="submit" class="btn btn-sm btn-light" id="apply"><i class="fa fa-filter text-primary"></i> [[admin/advanced/events:filters-apply]]</button>
						<button class="btn btn-sm btn-light" data-action="clear">
							<i class="fa fa-trash text-danger"></i> [[admin/advanced/events:delete-events]]
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
</div>

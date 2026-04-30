<div component="settings/main/header" class="row border-bottom py-2 m-0 mb-3 sticky-top acp-page-main-header align-items-center">
	<div class="col-12 col-md-8 px-0 mb-1 mb-md-0">
		<h4 class="fw-bold tracking-tight mb-0">{title}</h4>
	</div>
</div>

<div class="row flex-column-reverse flex-md-row">
	<div id="relays" class="col-12 col-md-4">
		<p>[[admin/settings/activitypub:relays.intro]]</p>
		<p class="text-warning">[[admin/settings/activitypub:relays.warning]]</p>
		<div class="mb-3 table-responsive-md">
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
	<div class="col-12 col-md-8">
		<div class="card">
			<div class="card-body">
				<div class="mb-3 row">
					<div class="col-6">
						<label class="form-label" for="hostFilter">[[admin/settings/activitypub:analytics.by-hostname]] ({relays.length})</label>
						<select class="form-select" autocomplete="off" id="hostFilter">
							<option value="">All relays</option>
							{{{ each relays }}}
							<option value="{./url}">{./url}</option>
							{{{ end }}}
						</select>
					</div>
					<div class="col-6">
						<label class="form-label" for="term">[[admin/settings/activitypub:analytics.term]]</label>
						<select class="form-select" autocomplete="off" id="term">
							<option value="hourly">[[admin/settings/activitypub:analytics.hourly]]</option>
							<option value="daily">[[admin/settings/activitypub:analytics.daily]]</option>
						</select>
					</div>
				</div>
				<canvas height="350"></canvas>
			</div>
		</div>
	</div>
</div>

<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 px-0 mb-4" tabindex="0">
			<div class="mb-4">
				<p class="lead">{{tx("admin/settings/activitypub:analytics.intro")}}</p>
				<p>{{tx("admin/settings/activitypub:analytics.details")}}</p>

				<div class="mb-3 row">
					<div class="col-6">
						<label class="form-label" for="hostFilter">{{tx("admin/settings/activitypub:analytics.by-hostname")}} ({instances.length})</label>
						<select class="form-select" autocomplete="off" id="hostFilter">
							<option value="">All instances</option>
							{{{ each instances }}}
							<option value="{@value}">{@value}</option>
							{{{ end }}}
						</select>
					</div>
					<div class="col-6">
						<label class="form-label" for="term">{{tx("admin/settings/activitypub:analytics.term")}}</label>
						<select class="form-select" autocomplete="off" id="term">
							<option value="hourly">{{tx("admin/settings/activitypub:analytics.hourly")}}</option>
							<option value="daily">{{tx("admin/settings/activitypub:analytics.daily")}}</option>
						</select>
					</div>
				</div>
			</div>

			<hr />

			<div class="mb-4">
				<div class="card">
					<div class="card-header">{{tx("admin/settings/activitypub:analytics.in")}}</div>
					<div class="card-body">
						<div class="position-relative" style="aspect-ratio: 2;">
							<canvas id="received" height="250"></canvas>
						</div>
					</div>
				</div>
			</div>

			<div class="mb-4">
				<div class="card">
					<div class="card-header">{{tx("admin/settings/activitypub:analytics.out")}}</div>
					<div class="card-body">
						<div class="position-relative" style="aspect-ratio: 2;">
							<canvas id="sent" height="250"></canvas>
						</div>
					</div>
				</div>
			</div>

			<div class="mb-4">
				<div class="card">
					<div class="card-header">{{tx("admin/settings/activitypub:analytics.activities_by_type")}}</div>
					<div class="card-body">
						<div class="row">
							<div class="col-md-6">
								<div class="position-relative" style="aspect-ratio: 1;">
									<canvas id="activitiesByType"></canvas>
								</div>
							</div>
							<div class="col-md-6 d-flex align-items-center">
								<ul id="activitiesByTypeLegend" class="list-unstyled mb-0"></ul>
							</div>
						</div>
						<p class="text-muted mt-3 mb-0 small">{{tx("admin/settings/activitypub:analytics.activities_by_type_not_filterable")}}</p>
					</div>
				</div>
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>

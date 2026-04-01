<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div class="mb-4">
				<p class="lead">[[admin/settings/activitypub:analytics.intro]]</p>
				<p>[[admin/settings/activitypub:analytics.details]]</p>

				<div class="mb-3 row">
					<div class="col-6">
						<label class="form-label" for="hostFilter">[[admin/settings/activitypub:analytics.by-hostname]] ({instances.length})</label>
						<select class="form-select" autocomplete="off" id="hostFilter">
							<option value="">All instances</option>
							{{{ each instances }}}
							<option value="{@value}">{@value}</option>
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
			</div>

			<hr />

			<div class="mb-4">
				<div class="card">
					<div class="card-header">[[admin/settings/activitypub:analytics.received]]</div>
					<div class="card-body">
						<div class="position-relative" style="aspect-ratio: 2;">
							<canvas id="received" height="250"></canvas>
						</div>
					</div>
				</div>
			</div>

			<div class="mb-4">
				<div class="card">
					<div class="card-header">[[admin/settings/activitypub:analytics.sent]]</div>
					<div class="card-body">
						<div class="position-relative" style="aspect-ratio: 2;">
							<canvas id="sent" height="250"></canvas>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>

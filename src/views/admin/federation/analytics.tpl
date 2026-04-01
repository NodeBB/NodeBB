<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="relays" class="mb-4">
				<p class="lead">[[admin/settings/activitypub:analytics.intro]]</p>
			</div>

			<div class="mb-4">
				<label class="fs-5 fw-bold tracking-tight settings-header mb-3">[[admin/settings/activitypub:analytics.activities]]</label>
				<div class="mb-3">
					<select class="form-select" autocomplete="off" id="hostFilter">
						<option value="">All instances</option>
						{{{ each instances }}}
						<option value="{@value}">{@value}</option>
						{{{ end }}}
					</select>
				</div>

				<div class="card">
					<div class="card-body">
						<div class="position-relative" style="aspect-ratio: 2;">
							<canvas id="activities" height="250"></canvas>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>

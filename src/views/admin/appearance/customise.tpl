<div class="tags d-flex flex-column gap-2 px-lg-4">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="d-flex flex-wrap gap-3 align-items-center">
			<h4 class="fw-bold tracking-tight mb-1">[[admin/appearance/customise:customise]]</h4>
			<ul class="nav nav-pills d-flex gap-1 text-sm">
				<li class="nav-item"><a class="nav-link active px-2 py-1" href="#custom-css" data-bs-toggle="tab">[[admin/appearance/customise:custom-css]]</a></li>
				<li class="nav-item"><a class="nav-link px-2 py-1" href="#custom-js" data-bs-toggle="tab">[[admin/appearance/customise:custom-js]]</a></li>
				<li class="nav-item"><a class="nav-link px-2 py-1" href="#custom-header" data-bs-toggle="tab">[[admin/appearance/customise:custom-header]]</a></li>
				<li class="nav-item"><a class="nav-link px-2 py-1" href="#bsvariables" data-bs-toggle="tab">[[admin/appearance/customise:bsvariables]]</a></li>
			</ul>
		</div>
		<div class="d-flex align-items-center gap-1">
			<button id="save" class="btn btn-primary btn-sm fw-semibold ff-secondary w-100 text-center text-nowrap">[[admin/admin:save-changes]]</button>
		</div>
	</div>

	<div id="customise" class="customise px-2">
		<div class="tab-content">
			<div class="tab-pane fade show active" id="custom-css">
				<p>
					[[admin/appearance/customise:custom-css.description]]
				</p>
				<div id="customCSS"></div>
				<input type="hidden" id="customCSS-holder" value="" data-field="customCSS" />

				<br />
				<form class="form">
					<div class="form-check form-switch">
						<input class="form-check-input" id="useCustomCSS" type="checkbox" data-field="useCustomCSS" />
						<label class="form-check-label" for="useCustomCSS">[[admin/appearance/customise:custom-css.enable]]</label>
					</div>
				</form>
			</div>

			<div class="tab-pane fade" id="custom-js">
				<p>
					[[admin/appearance/customise:custom-js.description]]
				</p>
				<div id="customJS"></div>
				<input type="hidden" id="customJS-holder" value="" data-field="customJS" />

				<br />
				<form class="form">
					<div class="form-check form-switch">
						<input class="form-check-input" id="useCustomJS" type="checkbox" data-field="useCustomJS" />
						<label class="form-check-label" for="useCustomJS">[[admin/appearance/customise:custom-js.enable]]</label>
					</div>
				</form>
			</div>

			<div class="tab-pane fade" id="custom-header">
				<p>
					[[admin/appearance/customise:custom-header.description]]
				</p>

				<div id="customHTML"></div>
				<input type="hidden" id="customHTML-holder" value="" data-field="customHTML" />

				<br/>

				<form class="form">
					<div class="form-check form-switch">
						<input class="form-check-input" id="useCustomHTML" type="checkbox" data-field="useCustomHTML" />
						<label class="form-check-label" for="useCustomHTML">[[admin/appearance/customise:custom-header.enable]]</label>
					</div>
				</form>
			</div>

			<div class="tab-pane fade" id="bsvariables">
				<p>
					[[admin/appearance/customise:bsvariables.description]]
				</p>

				<div id="customVariables"></div>
				<input type="hidden" id="customVariables-holder" value="" data-field="bsVariables" />

				<br/>

				<form class="form">
					<div class="form-check form-switch">
						<input class="form-check-input" id="useBSVariables" type="checkbox" data-field="useBSVariables" />
						<label class="form-check-label" for="useBSVariables">[[admin/appearance/customise:bsvariables.enable]]</label>
					</div>
				</form>
			</div>


			<form class="form">
				<div class="form-check form-switch">
					<input class="form-check-input" id="enableLiveReload" type="checkbox" data-field="enableLiveReload" checked />
					<label class="form-check-label" for="enableLiveReload">[[admin/appearance/customise:custom-css.livereload]]</label>
					<div class="form-text">[[admin/appearance/customise:custom-css.livereload.description]]</div>
				</div>
			</form>
		</div>
	</div>
</div>

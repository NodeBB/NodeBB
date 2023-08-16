<div class="logger settings d-flex flex-column gap-2 px-lg-4">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/development/logger:logger]]</h4>
		</div>
		<div class="d-flex align-items-center">
			<button id="save" class="btn btn-primary btn-sm fw-semibold ff-secondary w-100 text-center text-nowrap">[[admin/admin:save-changes]]</button>
		</div>
	</div>

	<div class="card-body">
		<p>
			[[admin/development/logger:description]]
		</p>
		<br/>
		<p>
			[[admin/development/logger:explanation]]
		</p>
		<br/>

		<form>
			<div class="form-check form-switch mb-3">
				<input class="form-check-input" type="checkbox" id="loggerStatus" data-field="loggerStatus">
				<label for="loggerStatus" class="form-check-label">[[admin/development/logger:enable-http]]</label>
			</div>

			<div class="form-check form-switch mb-3">
				<input class="form-check-input" type="checkbox" id="loggerIOStatus" data-field="loggerIOStatus">
				<label for="loggerIOStatus" class="form-check-label">[[admin/development/logger:enable-socket]]</label>
			</div>

			<label class="form-label" for="loggerPath">[[admin/development/logger:file-path]]</label>
			<input id="loggerPath" class="form-control" type="text" placeholder="[[admin/development/logger:file-path-placeholder]]" data-field="loggerPath" />
		</form>
	</div>
</div>


<div id="customise" class="customise">
	<ul class="nav nav-pills mb-3">
		<li class="nav-item"><a class="nav-link active" href="#custom-css" data-bs-toggle="tab">[[admin/appearance/customise:custom-css]]</a></li>
		<li class="nav-item"><a class="nav-link" href="#custom-js" data-bs-toggle="tab">[[admin/appearance/customise:custom-js]]</a></li>
		<li class="nav-item"><a class="nav-link" href="#custom-header" data-bs-toggle="tab">[[admin/appearance/customise:custom-header]]</a></li>
	</ul>

	<div class="tab-content">
		<div class="tab-pane fade show active" id="custom-css">
			<p>
				[[admin/appearance/customise:custom-css.description]]
			</p>
			<div id="customCSS"></div>
			<input type="hidden" id="customCSS-holder" value="" data-field="customCSS" />

			<br />
			<form class="form">
				<div class="form-check">
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
				<div class="form-check">
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

			<br />
			<form class="form">
				<div class="form-check">
					<input class="form-check-input" id="useCustomHTML" type="checkbox" data-field="useCustomHTML" />
					<label class="form-check-label" for="useCustomHTML">[[admin/appearance/customise:custom-header.enable]]</label>
				</div>
			</form>
		</div>

		<form class="form">
			<div class="form-check">
				<input class="form-check-input" id="enableLiveReload" type="checkbox" data-field="enableLiveReload" checked />
				<label class="form-check-label" for="enableLiveReload">[[admin/appearance/customise:custom-css.livereload]]</label>
				<div class="form-text">[[admin/appearance/customise:custom-css.livereload.description]]</div>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/save_button.tpl -->
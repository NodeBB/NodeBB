<div id="customise" class="customise">
	<ul class="nav nav-pills">
		<li class="active"><a href="#custom-css" data-toggle="tab">[[admin/appearance/customise:custom-css]]</a></li>
		<li><a href="#custom-js" data-toggle="tab">[[admin/appearance/customise:custom-js]]</a></li>
		<li><a href="#custom-header" data-toggle="tab">[[admin/appearance/customise:custom-header]]</a></li>
	</ul>
	<br />
	<div class="tab-content">
		<div class="tab-pane fade active in" id="custom-css">
			<p>
				[[admin/appearance/customise:custom-css.description]]
			</p>
			<div id="customCSS"></div>
			<input type="hidden" id="customCSS-holder" value="" data-field="customCSS" />

			<br />
			<form class="form">
				<div class="form-group">
					<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="useCustomCSS">
						<input class="mdl-switch__input" id="useCustomCSS" type="checkbox" data-field="useCustomCSS" />
						<span class="mdl-switch__label">[[admin/appearance/customise:custom-css.enable]]</span>
					</label>
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
				<div class="form-group">
					<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="useCustomJS">
						<input class="mdl-switch__input" id="useCustomJS" type="checkbox" data-field="useCustomJS" />
						<span class="mdl-switch__label">[[admin/appearance/customise:custom-js.enable]]</span>
					</label>
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
				<div class="form-group">
					<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="useCustomHTML">
						<input class="mdl-switch__input" id="useCustomHTML" type="checkbox" data-field="useCustomHTML" />
						<span class="mdl-switch__label">[[admin/appearance/customise:custom-header.enable]]</span>
					</label>
				</div>
			</form>
		</div>

		<form class="form">
			<div class="form-group">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="enableLiveReload">
					<input class="mdl-switch__input" id="enableLiveReload" type="checkbox" data-field="enableLiveReload" checked />
					<span class="mdl-switch__label">
						[[admin/appearance/customise:custom-css.livereload]]
						<small>[[admin/appearance/customise:custom-css.livereload.description]]</small>
					</span>
				</label>
			</div>
		</form>
	</div>
</div>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">save</i>
</button>
<div id="customise" class="customise">
	<ul class="nav nav-pills">
		<li class="active"><a href="#custom-css" data-toggle="tab">Custom CSS</a></li>
		<li><a href="#custom-header" data-toggle="tab">Custom Header</a></li>
	</ul>
	<br />
	<div class="tab-content">
		<div class="tab-pane fade active in" id="custom-css">
			<p>
				Enter your own CSS declarations here, which will be applied after all other styles.
			</p>
			<div id="customCSS"></div>
			<input type="hidden" id="customCSS-holder" value="" data-field="customCSS" />

			<br />
			<form class="form">
				<div class="form-group">
					<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="useCustomCSS">
						<input class="mdl-switch__input" id="useCustomCSS" type="checkbox" data-field="useCustomCSS" />
						<span class="mdl-switch__label">Enable Custom CSS</span>
					</label>
				</div>
			</form>
		</div>
		<div class="tab-pane fade" id="custom-header">
			<p>
				Enter custom HTML here (ex. JavaScript, Meta Tags, etc.), which will be appended to the <code>&lt;head&gt;</code> section of your forum's markup.
			</p>

			<div id="customHTML"></div>
			<input type="hidden" id="customHTML-holder" value="" data-field="customJS" />

			<br />
			<form class="form">
				<div class="form-group">
					<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="useCustomJS">
						<input class="mdl-switch__input" id="useCustomJS" type="checkbox" data-field="useCustomJS" />
						<span class="mdl-switch__label">Enable Custom Header</span>
					</label>
				</div>
			</form>
		</div>
	</div>
</div>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">save</i>
</button>
<!-- IMPORT admin/appearance/header.tpl -->

<div id="customise">
	<h3>Custom CSS</h3>
	<p>
		You may also opt to enter your own CSS declarations here, which will be applied after all other styles.
	</p>
	<div id="customCSS"></div>
	<input type="hidden" id="customCSS-holder" value="" data-field="customCSS" />

	<form class="form">
		<div class="form-group">
			<label for="useCustomCSS">
				Use Custom CSS?
				<input id="useCustomCSS" type="checkbox" data-field="useCustomCSS" />
			</label>
		</div>
	</form>

	<h3>Custom Header</h3>
	<p>
		You can enter custom HTML here (ex. JavaScript, Meta Tags, etc.) which will be appended to the <code>&lt;head&gt;</code> section of your forum's markup.
	</p>

	<div id="customHTML"></div>
	<input type="hidden" id="customHTML-holder" value="" data-field="customJS" />

	<form class="form">
		<div class="form-group">
			<label for="useCustomJS">
				Use Custom Header?
				<input id="useCustomJS" type="checkbox" data-field="useCustomJS" />
			</label>
		</div>
	</form>

	<button class="btn btn-primary" id="save">Save</button>
</div>

<!-- IMPORT admin/appearance/footer.tpl -->
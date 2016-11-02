<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">EU Consent</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<div class="checkbox">
					<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
						<input type="checkbox" class="mdl-switch__input" id="cookieConsentEnabled" data-field="cookieConsentEnabled">
						<span class="mdl-switch__label"><strong>Enabled</strong></span>
					</label>
				</div>
			</div>
			<div class="form-group">
				<label for="cookieConsentMessage">Notification message</label>
				<input class="form-control" id="cookieConsentMessage" type="text" data-field="cookieConsentMessage" />
				<p class="help-block">
					Leave blank to use NodeBB localised defaults
				</p>
			</div>
			<div class="form-group">
				<label for="cookieConsentDismiss">Acceptance message</label>
				<input class="form-control" id="cookieConsentDismiss" type="text" data-field="cookieConsentDismiss" />
				<p class="help-block">
					Leave blank to use NodeBB localised defaults
				</p>
			</div>
			<div class="form-group">
				<label for="cookieConsentLink">Policy Link Text</label>
				<input class="form-control" id="cookieConsentLink" type="text" data-field="cookieConsentLink" />
				<p class="help-block">
					Leave blank to use NodeBB localised defaults
				</p>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Display</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="cookieConsentStyle">Notification style</label>
				<select class="form-control" id="cookieConsentStyle" data-field="cookieConsentStyle">
					<option value="block">Block</option>
					<option value="edgeless" selected>Edgeless</option>
					<option value="classic">Classic</option>
				</select>
			</div>
			<div class="form-group">
				<label for="cookieConsentPosition">Position</label>
				<select class="form-control" id="cookieConsentPosition" data-field="cookieConsentPosition">
					<option value="top">Top</option>
					<option value="bottom" selected>Bottom</option>
					<option value="top-left">Top Left</option>
					<option value="top-right">Top Right</option>
					<option value="bottom-left" selected>Bottom Left</option>
					<option value="bottom-right">Bottom Right</option>
				</select>
			</div>
			<div class="form-group">
				<label for="cookieConsentPaletteBackground">Background Color</label>
				<input class="form-control" id="cookieConsentPaletteBackground" type="text" placeholder="#edeff5" data-field="cookieConsentPaletteBackground" data-colorpicker="1" />
			</div>
			<div class="form-group">
				<label for="cookieConsentPaletteText">Text Color</label>
				<input class="form-control" id="cookieConsentPaletteText" type="text" placeholder="#838391" data-field="cookieConsentPaletteText" data-colorpicker="1" />
			</div>
			<div class="form-group">
				<label for="cookieConsentPaletteButton">Button Background Color</label>
				<input class="form-control" id="cookieConsentPaletteButton" type="text" placeholder="#59b3d0" data-field="cookieConsentPaletteButton" data-colorpicker="1" />
			</div>
			<div class="form-group">
				<label for="cookieConsentPaletteButtonText">Button Text Color</label>
				<input class="form-control" id="cookieConsentPaletteButtonText" type="text" placeholder="#ffffff" data-field="cookieConsentPaletteButtonText" data-colorpicker="1" />
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Settings</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="cookieDomain">Session cookie domain</label>
				<input class="form-control" id="cookieDomain" type="text" placeholder=".domain.tld" data-field="cookieDomain" /><br />
				<p class="help-block">
					Leave blank for default
				</p>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->

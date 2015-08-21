<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">
		Site Settings
	</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<label>Site Title</label>
			<input class="form-control" type="text" placeholder="Your Community Name" data-field="title" />

			<div class="checkbox">
				<label for="showSiteTitle" class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" id="showSiteTitle" data-field="showSiteTitle" name="showSiteTitle" />
					<span class="mdl-switch__label">Show Site Title in Header</span>
				</label>
			</div>

			<label>Browser Title</label>
			<input class="form-control" type="text" placeholder="Browser Title" data-field="browserTitle" />
			<p class="help-block">
				If no browser title is specified, the site title will be used
			</p>

			<label>Site Description</label>
			<input type="text" class="form-control" placeholder="A short description about your community" data-field="description" /><br />

			<label>Site Keywords</label>
			<input type="text" class="form-control" placeholder="Keywords describing your community, comma-seperated" data-field="keywords" /><br />
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Site Logo</div>
	<div class="col-sm-10 col-xs-12">
		<div class="form-group">
			<label for="logoUrl">Image</label>
			<div class="input-group">
				<input id="logoUrl" type="text" class="form-control" placeholder="Path to a logo to display on forum header" data-field="brand:logo" data-action="upload" data-target="logoUrl" data-route="{config.relative_path}/api/admin/uploadlogo" readonly />
				<span class="input-group-btn">
					<input data-action="upload" data-target="logoUrl" data-route="{config.relative_path}/api/admin/uploadlogo" type="button" class="btn btn-default" value="Upload"></input>
				</span>
			</div>
		</div>
		<div class="form-group">
			<label for="brand:logo:url">URL</label>
			<input id ="brand:logo:url" type="text" class="form-control" placeholder="The URL of the site logo" data-field="brand:logo:url" />
			<p class="help-block">
				When the logo is clicked, send users to this address. If left blank, user will be sent to the forum index.
			</p>
		</div>
		<div class="form-group">
			<label for="brand:logo:alt">Alt Text</label>
			<input id ="brand:logo:alt" type="text" class="form-control" placeholder="Alternative text for accessibility" data-field="brand:logo:alt" />
		</div>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">
		Favicon
	</div>
	<div class="col-sm-10 col-xs-12">
		<div class="form-group">
			<div class="input-group">
				<input id="faviconUrl" type="text" class="form-control" placeholder="favicon.ico" data-field="brand:favicon" data-action="upload" data-target="faviconUrl" data-route="{config.relative_path}/api/admin/uploadfavicon" readonly />
				<span class="input-group-btn">
					<input data-action="upload" data-target="faviconUrl" data-route="{config.relative_path}/api/admin/uploadfavicon" type="button" class="btn btn-default" value="Upload"></input>
				</span>
			</div>
		</div>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Miscellaneous</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" id="showSiteTitle" data-field="useOutgoingLinksPage">
					<span class="mdl-switch__label"><strong>Use Outgoing Links Warning Page</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" id="showSiteTitle" data-field="disableSocialButtons">
					<span class="mdl-switch__label"><strong>Disable social buttons</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" id="showSiteTitle" data-field="disableChat">
					<span class="mdl-switch__label"><strong>Disable chat</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
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

			<label>Title Layout</label>
			<input class="form-control" type="text" placeholder="Title Layout" data-field="titleLayout" />
			<p class="help-block">
				Define how the browser title will be structured ie. &#123;pageTitle&#125; | &#123;browserTitle&#125;
			</p>

			<label>Site Description</label>
			<input type="text" class="form-control" placeholder="A short description about your community" data-field="description" /><br />

			<label>Site Keywords</label>
			<input type="text" class="form-control" placeholder="Keywords describing your community, comma-separated" data-field="keywords" /><br />
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
					<button data-action="removeLogo" type="button" class="btn btn-default btn-danger"><i class="fa fa-times"></i></button>
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
					<input data-action="upload" data-target="faviconUrl" data-route="{config.relative_path}/api/admin/uploadfavicon" data-help="0" type="button" class="btn btn-default" value="Upload"></input>
					<button data-action="removeFavicon" type="button" class="btn btn-default btn-danger"><i class="fa fa-times"></i></button>
				</span>
			</div>
		</div>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">
		Homescreen/Touch Icon
	</div>
	<div class="col-sm-10 col-xs-12">
		<div class="form-group">
			<div class="input-group">
				<input id="touchIconUrl" type="text" class="form-control" data-field="brand:touchIcon" data-action="upload" data-target="touchIconUrl" data-route="{config.relative_path}/api/admin/uploadTouchIcon" readonly />
				<span class="input-group-btn">
					<input data-action="upload" data-target="touchIconUrl" data-route="{config.relative_path}/api/admin/uploadTouchIcon" type="button" class="btn btn-default" value="Upload"></input>
					<button data-action="removeTouchIcon" type="button" class="btn btn-default btn-danger"><i class="fa fa-times"></i></button>
				</span>
			</div>
			<p class="help-block">
				Recommended size and format: 192x192, PNG format only. If no touch icon is specified, NodeBB will fall back to using the favicon.
			</p>
		</div>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Outgoing Links</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" id="showSiteTitle" data-field="useOutgoingLinksPage">
					<span class="mdl-switch__label"><strong>Use Outgoing Links Warning Page</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
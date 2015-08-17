<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
	<div class="panel-heading">Site Settings</div>
	<div class="panel-body">
		<form>
			<label>Site Title</label>
			<input class="form-control" type="text" placeholder="Your Community Name" data-field="title" />

			<div class="checkbox">
				<label for="showSiteTitle">
					<input type="checkbox" id="showSiteTitle" data-field="showSiteTitle" name="showSiteTitle" /> Show Site Title in Header
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

<div class="panel panel-default">
	<div class="panel-heading">Site Logo</div>
	<div class="panel-body">
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

<div class="panel panel-default">
	<div class="panel-heading">Favicon</div>
	<div class="panel-body">
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

<div class="panel panel-default">
	<div class="panel-heading">Miscellaneous</div>
	<div class="panel-body">
		<form>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="useOutgoingLinksPage"> <strong>Use Outgoing Links Warning Page</strong>
				</label>
			</div>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="disableSocialButtons"> <strong>Disable social buttons</strong>
				</label>
			</div>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="disableChat"> <strong>Disable chat</strong>
				</label>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
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
			
			<div class="checkbox">
				<label for="showBrowserTitle">
					<input type="checkbox" id="showBrowserTitle" data-field="showBrowserTitle" name="showBrowserTitle" /> Show Browser Title
				</label>
			</div>

			<label>Main Page Description</label>
			<input type="text" class="form-control" placeholder="A short description about your community main page" data-field="description" /><br />
			
			<label>Main Page Content</label>
			<a class="help-markdown" href="http://daringfireball.net/projects/markdown/syntax" target="_blank">Markdown supported <span class="help"><i class="fa fa-question-circle"></i></span></a>
			<textarea type="text" class="form-control" placeholder="The text of the upper part of the main board page" data-field="content"></textarea><br />

			<label>Main Page Keywords</label>
			<input type="text" class="form-control" placeholder="Keywords describing your community main page, comma-seperated" data-field="keywords" /><br />
		</form>
	</div>
</div>

<div class="panel panel-default">
	<div class="panel-heading">Site Logo</div>
	<div class="panel-body">
		<form>
			<label>Site Logo</label>
			<input id="logoUrl" type="text" class="form-control" placeholder="Path to a logo to display on forum header" data-field="brand:logo" /><br />
			<input data-action="upload" data-target="logoUrl" data-route="{config.relative_path}/api/admin/uploadlogo" type="button" class="btn btn-default" value="Upload Logo"></input>
		</form>
	</div>
</div>

<div class="panel panel-default">
	<div class="panel-heading">Favicon</div>
	<div class="panel-body">
		<form>
			<label>Favicon</label><br />
			<input id="faviconUrl" type="text" class="form-control" placeholder="favicon.ico" data-field="brand:favicon" /><br />
			<input data-action="upload" data-target="faviconUrl" data-route="{config.relative_path}/api/admin/uploadfavicon" type="button" class="btn btn-default" value="Upload"></input>
		</form>
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
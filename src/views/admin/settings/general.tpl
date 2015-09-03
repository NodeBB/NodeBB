<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">
		[[admin:general.site_settings]]
	</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<label>[[admin:general.site_title]]</label>
			<input class="form-control" type="text" placeholder="[[admin:general.site_title.placeholder]]" data-field="title" />

			<div class="checkbox">
				<label for="showSiteTitle" class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" id="showSiteTitle" data-field="showSiteTitle" name="showSiteTitle" />
					<span class="mdl-switch__label">[[admin:general.show_site_title_in_header]]</span>
				</label>
			</div>

			<label>[[admin:general.browser_title]]</label>
			<input class="form-control" type="text" placeholder="[[admin:general.browser_title.placeholder]]" data-field="browserTitle" />
			<p class="help-block">
				[[admin:general.browser_title.help]]
			</p>

			<label>[[admin:general.site_description]]</label>
			<input type="text" class="form-control" placeholder="[[admin:general.site_description.placeholder]]" data-field="description" /><br />

			<label>[[admin:general.site_keywords]]</label>
			<input type="text" class="form-control" placeholder="[[admin:general.site_keywords.placeholder]]" data-field="keywords" /><br />
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:general.site_logo]]</div>
	<div class="col-sm-10 col-xs-12">
		<div class="form-group">
			<label for="logoUrl">[[admin:general.image]]</label>
			<div class="input-group">
				<input id="logoUrl" type="text" class="form-control" placeholder="Path to a logo to display on forum header" data-field="brand:logo" data-action="upload" data-target="logoUrl" data-route="{config.relative_path}/api/admin/uploadlogo" readonly />
				<span class="input-group-btn">
					<input data-action="upload" data-target="logoUrl" data-route="{config.relative_path}/api/admin/uploadlogo" type="button" class="btn btn-default" value="[[admin:general.upload]]"></input>
					<button data-action="removeLogo" type="button" class="btn btn-default btn-danger"><i class="fa fa-times"></i></button>
				</span>
			</div>
		</div>
		<div class="form-group">
			<label for="brand:logo:url">[[admin:general.url]]</label>
			<input id ="brand:logo:url" type="text" class="form-control" placeholder="[[admin:general.url.placeholder]]" data-field="brand:logo:url" />
			<p class="help-block">
				[[admin:general.url.help]]
			</p>
		</div>
		<div class="form-group">
			<label for="brand:logo:alt">[[admin:general.alt_text]]</label>
			<input id ="brand:logo:alt" type="text" class="form-control" placeholder="[[admin:general.alt_text.placeholder]]" data-field="brand:logo:alt" />
		</div>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">
		[[admin:general.favicon]]
	</div>
	<div class="col-sm-10 col-xs-12">
		<div class="form-group">
			<div class="input-group">
				<input id="faviconUrl" type="text" class="form-control" placeholder="favicon.ico" data-field="brand:favicon" data-action="upload" data-target="faviconUrl" data-route="{config.relative_path}/api/admin/uploadfavicon" readonly />
				<span class="input-group-btn">
					<input data-action="upload" data-target="faviconUrl" data-route="{config.relative_path}/api/admin/uploadfavicon" type="button" class="btn btn-default" value="[[admin:general.upload]]"></input>
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
					<span class="mdl-switch__label"><strong>[[admin:general.use_outgoing_links_warning_page]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" id="showSiteTitle" data-field="disableSocialButtons">
					<span class="mdl-switch__label"><strong>[[admin:general.disable_social_buttons]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" id="showSiteTitle" data-field="disableChat">
					<span class="mdl-switch__label"><strong>[[admin:general.disable_chat]]</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->

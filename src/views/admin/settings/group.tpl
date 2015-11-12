<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">General</div>
	<div class="col-sm-10 col-xs-12">
		<form role="form">
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowPrivateGroups">
					<span class="mdl-switch__label"><strong>Private Groups</strong></span>
				</label>
			</div>

			<p class="help-block">
				If enabled, joining of groups requires the approval of the group owner <em>(Default: enabled)</em>
			</p>
			<p class="help-block">
				<strong>Beware!</strong> If this option is disabled and you have private groups, they automatically become public.
			</p>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowGroupCreation">
					<span class="mdl-switch__label"><strong>Allow Group Creation</strong></span>
				</label>
			</div>

			<p class="help-block">
				If enabled, users can create groups <em>(Default: disabled)</em>
			</p>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Group Cover Image</div>
	<div class="col-sm-10 col-xs-12">
		<form role="form">
			<label for="groups:defaultCovers"><strong>Default Cover Images</strong></label>
			<p class="help-block">
				Add comma-separated default cover images for groups that don't have an uploaded cover image
			</p>
			<input type="text" class="form-control input-lg" id="groups:defaultCovers" data-field="groups:defaultCovers" value="{config.relative_path}/images/cover-default.png" placeholder="https://example.com/group1.png, https://example.com/group2.png" /><br />
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
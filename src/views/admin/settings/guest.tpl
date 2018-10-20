<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/guest:handles]]</div>
	<div class="col-sm-10 col-xs-12">
		<form role="form">
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowGuestHandles">
					<span class="mdl-switch__label"><strong>[[admin/settings/guest:handles.enabled]]</strong></span>
				</label>
			</div>
			<p class="help-block">
				[[admin/settings/guest:handles.enabled-help]]
			</p>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
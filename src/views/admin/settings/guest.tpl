<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Guest Handles</div>
	<div class="col-sm-10 col-xs-12">
		<form role="form">
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowGuestHandles">
					<span class="mdl-switch__label"><strong>Allow guest handles</strong></span>
				</label>
			</div>
			<p class="help-block">
				This option exposes a new field that allows guests to pick a name to associate with each post they make. If disabled,
				the will simply be called "Guest"
			</p>
		</form>
	</div>
</div>


<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Guest Privileges</div>
	<div class="col-sm-10 col-xs-12">
		<form role="form">
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowGuestSearching">
					<span class="mdl-switch__label"><strong>Allow guests to search without logging in</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowGuestUserSearching">
					<span class="mdl-switch__label"><strong>Allow guests to search users without logging in</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
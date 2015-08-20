<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-xs-2 settings-header">Guest Handles</div>
	<div class="col-xs-10">
		<form role="form">
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="allowGuestHandles"> <strong>Allow guest handles</strong>
					<p class="help-block">
						This option exposes a new field that allows guests to pick a name to associate with each post they make. If disabled,
						the will simply be called "Guest"
					</p>
				</label>
			</div>
		</form>
	</div>
</div>


<div class="row">
	<div class="col-xs-2 settings-header">Guest Privileges</div>
	<div class="col-xs-10">
		<form role="form">
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="allowGuestSearching"> <strong>Allow guests to search without logging in</strong>
				</label>
			</div>

			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="allowGuestUserSearching"> <strong>Allow guests to search users without logging in</strong>
				</label>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
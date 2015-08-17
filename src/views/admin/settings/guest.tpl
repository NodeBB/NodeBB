<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
	<div class="panel-heading">Guests</div>
	<div class="panel-body">
		<p class="alert alert-info">
			These options affect guest users as a whole. Control over which categories a guest can see or post to is handled in
			the categories themselves
		</p>

		<form role="form">
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="allowGuestHandles"> <strong>Allow guest handles</strong>
					<p class="help-block">
						This option exposes a new field that allows guests to pick a name to associate with each post they make. If disabled,
						the will simply be called "Guest" (or the equivalent in the forum&apos;s selected language)
					</p>
				</label>
			</div>

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
<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:group.general]]</div>
	<div class="col-sm-10 col-xs-12">
		<form role="form">
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowPrivateGroups" checked>
					<span class="mdl-switch__label"><strong>[[admin:group.private_groups]]</strong></span>
				</label>
			</div>

			<p class="help-block">
			        [[admin:group.private_groups.help]]
			</p>
			<p class="help-block">
			        [[admin:group.private_groups.help2]]
			</p>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowGroupCreation">
					<span class="mdl-switch__label"><strong>[[admin:group.allow_group_creation]]</strong></span>
				</label>
			</div>

			<p class="help-block">
				[[admin:group.allow_group_creation.help]]
			</p>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->

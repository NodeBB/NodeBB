<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
	<div class="panel-heading">[[admin:group.general]]</div>
	<div class="panel-body">
		<form role="form">
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="allowPrivateGroups" checked> <strong>[[admin:group.private_groups]]</strong>
					<p class="help-block">
						[[admin:group.private_groups.help]]
					</p>
					<p class="help-block">
						[[admin:group.private_groups.help2]]
					</p>
				</label>
			</div>

			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="allowGroupCreation"> <strong>[[admin:group.allow_group_creation]]</strong>
					<p class="help-block">
						[[admin:group.allow_group_creation.help]]
					</p>
				</label>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
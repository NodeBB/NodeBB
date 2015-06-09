<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
	<div class="panel-heading">General</div>
	<div class="panel-body">
		<form role="form">
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="allowPrivateGroups" checked> <strong>Private Groups</strong>
					<p class="help-block">
						If enabled, joining of groups requires the approval of the group owner <em>(Default: enabled)</em>
					</p>
					<p class="help-block">
						<strong>Beware!</strong> If this option is disabled and you have private groups, they automatically become public.
					</p>
				</label>
			</div>

			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="allowGroupCreation"> <strong>Allow Group Creation</strong>
					<p class="help-block">
						If enabled, users can create groups <em>(Default: disabled)</em>
					</p>
				</label>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
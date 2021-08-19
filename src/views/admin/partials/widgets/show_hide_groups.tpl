<div class="row">
	<div class="col-lg-6">
		<label>[[admin/extend/widgets:show-to-groups]]</label>
		<select name="groups" class="form-control" multiple size="10">
			<!-- BEGIN groups -->
			<option value="{groups.displayName}">{groups.displayName}</option>
			<!-- END groups -->
		</select>
	</div>
	<div class="col-lg-6">
		<label>[[admin/extend/widgets:hide-from-groups]]</label>
		<select name="groupsHideFrom" class="form-control" multiple size="10">
			<!-- BEGIN groups -->
			<option value="{groups.displayName}">{groups.displayName}</option>
			<!-- END groups -->
		</select>
	</div>
</div>
<div class="row mb-3">
	<div class="col-lg-6">
		<label class="form-label">[[admin/extend/widgets:show-to-groups]]</label>
		<select name="groups" class="form-select" multiple size="10">
			{{{ each groups }}}
			<option value="{./displayName}">{./displayName}</option>
			{{{ end }}}
		</select>
	</div>
	<div class="col-lg-6">
		<label class="form-label">[[admin/extend/widgets:hide-from-groups]]</label>
		<select name="groupsHideFrom" class="form-select" multiple size="10">
			{{{ each groups }}}
			<option value="{./displayName}">{./displayName}</option>
			{{{ end }}}
		</select>
	</div>
</div>
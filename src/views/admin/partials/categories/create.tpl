<form type="form">
	<div class="mb-3">
		<label class="form-label" for="name">[[admin/manage/categories:name]]</label>
		<input type="text" class="form-control" name="name" id="name" />
	</div>
	<div class="mb-3" id="parentCidGroup">
		<label class="form-label" for="parentCid">[[admin/manage/categories:optional-parent-category]]</label>
		<!-- IMPORT admin/partials/category/selector-dropdown-left.tpl -->
	</div>

	<div class="mb-3" id="cloneFromCidGroup">
		<div class="mb-3">
			<label class="form-label" for="cloneFromCid">[[admin/manage/categories:optional-clone-settings]]</label>

			<!-- IMPORT admin/partials/category/selector-dropdown-left.tpl -->
		</div>
		<div class="form-check form-switch">
			<input class="form-check-input "id="cloneChildren" name="cloneChildren" type="checkbox">
			<label for="cloneChildren" class="form-check-label">[[admin/manage/categories:clone-children]]</label>
		</div>
	</div>

	<div class="mb-3">
		<div class="form-check form-switch">
			<input class="form-check-input "id="disabled" name="disabled" type="checkbox">
			<label for="disabled" class="form-check-label">[[admin/manage/categories:disable-on-create]]</label>
		</div>
	</div>
</form>
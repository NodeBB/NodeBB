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
		<label class="form-label" for="cloneFromCid">[[admin/manage/categories:optional-clone-settings]]</label>
		<!-- IMPORT admin/partials/category/selector-dropdown-left.tpl -->
		<label>
			<input id="cloneChildren" name="cloneChildren" type="checkbox">
			<strong>[[admin/manage/categories:clone-children]]</strong>
		</label>
	</div>

	<div class="mb-3">
		<label>
			<input id="disabled" name="disabled" type="checkbox">
			<strong>[[admin/manage/categories:disable-on-create]]</strong>
		</label>
	</div>
</form>
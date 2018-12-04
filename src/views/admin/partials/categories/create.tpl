<form type="form">
	<div class="form-group">
		<label for="name">[[admin/manage/categories:name]]</label>
		<input type="text" class="form-control" name="name" id="name" />
	</div>
	<div class="form-group" id="parentCidGroup">
		<label for="parentCid">[[admin/manage/categories:optional-parent-category]]</label>
		<!-- IMPORT partials/category-selector.tpl -->
	</div>

	<div class="form-group" id="cloneFromCidGroup">
		<label for="cloneFromCid">[[admin/manage/categories:optional-clone-settings]]</label>
		<!-- IMPORT partials/category-selector.tpl -->
		<label>
			<input id="cloneChildren" name="cloneChildren" type="checkbox">
			<strong>[[admin/manage/categories:clone-children]]</strong>
		</label>
	</div>

	<div class="form-group">
		<label>
			<input id="disabled" name="disabled" type="checkbox">
			<strong>[[admin/manage/categories:disable-on-create]]</strong>
		</label>
	</div>

</form>
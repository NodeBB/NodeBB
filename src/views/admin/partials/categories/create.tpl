<form type="form">
	<div class="form-group">
		<label for="name">[[admin/manage/categories:name]]</label>
		<input type="text" class="form-control" name="name" id="name" />
	</div>
	<div class="form-group">
		<label for="parentCid">[[admin/manage/categories:optional-parent-category]]</label>
		<select class="form-control" name="parentCid" id="parentCid">
			<option value=""></option>
			<!-- BEGIN categories -->
			<option value="{categories.cid}">{categories.name}</option>
			<!-- END categories -->
		</select>
	</div>

	<div class="form-group">
		<label for="cloneFromCid">[[admin/manage/categories:optional-clone-settings]]</label>
		<select class="form-control" name="cloneFromCid" id="cloneFromCid">
			<option value=""></option>
			<!-- BEGIN categories -->
			<option value="{categories.cid}">{categories.name}</option>
			<!-- END categories -->
		</select>
	</div>
</form>
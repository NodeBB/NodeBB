<form type="form">
	<div class="form-group">
		<label for="name">Category Name</label>
		<input type="text" class="form-control" name="name" id="name" />
	</div>
	<div class="form-group">
		<label for="parentCid">(Optional) Parent Category</label>
		<select class="form-control" name="parentCid" id="parentCid">
			<option value=""></option>
			<!-- BEGIN categories -->
			<option value="{categories.cid}">{categories.name}</option>
			<!-- END categories -->
		</select>
	</div>

	<div class="form-group">
		<label for="cloneFromCid">(Optional) Clone Settings From Category</label>
		<select class="form-control" name="cloneFromCid" id="cloneFromCid">
			<option value=""></option>
			<!-- BEGIN categories -->
			<option value="{categories.cid}">{categories.name}</option>
			<!-- END categories -->
		</select>
	</div>
</form>
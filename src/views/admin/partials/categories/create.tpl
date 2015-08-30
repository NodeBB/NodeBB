<form type="form">
	<div class="form-group">
		<label for="name">[[admin:create.category_name]]</label>
		<input type="text" class="form-control" name="name" id="name" />
	</div>
	<div class="form-group">
		<label for="parentCid">[[admin:create.optional_parent_category]]</label>
		<select class="form-control" name="parentCid" id="parentCid">
			<option value=""></option>
			<!-- BEGIN categories -->
			<option value="{categories.cid}">{categories.name}</option>
			<!-- END categories -->
		</select>
	</div>
</form>
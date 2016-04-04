<form type="form">
	<div class="form-group">
		<label for="select-cid">Select Category</label>
		<select class="form-control" name="select-cid" id="select-cid">
			<!-- BEGIN categories -->
			<option value="{categories.cid}">{categories.name}</option>
			<!-- END categories -->
		</select>
	</div>
</form>
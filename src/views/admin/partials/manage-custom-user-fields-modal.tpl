<form>
	<div class="mb-3">
		<label class="form-label">[[admin/manage/user-custom-fields:type-of-input]]</label>
		<select class="form-select" id="type-select" name="type">
			<option value="input-text" {{{ if (type == "input-text") }}}selected{{{ end }}}>[[admin/manage/user-custom-fields:input-type-text]]</option>
			<option value="input-link" {{{ if (type == "input-link") }}}selected{{{ end }}}>[[admin/manage/user-custom-fields:input-type-link]]</option>
			<option value="input-number" {{{ if (type == "input-number") }}}selected{{{ end }}}>[[admin/manage/user-custom-fields:input-type-number]]</option>
			<option value="input-date" {{{ if (type == "input-date") }}}selected{{{ end }}}>[[admin/manage/user-custom-fields:input-type-date]]</option>
			<option value="select" {{{ if (type == "select") }}}selected{{{ end }}}>[[admin/manage/user-custom-fields:input-type-select]]</option>
			<option value="select-multi" {{{ if (type == "select-multi") }}}selected{{{ end }}}>[[admin/manage/user-custom-fields:input-type-select-multi]]</option>
		</select>
	</div>

	<div class="mb-3">
		<label class="form-label">[[admin/manage/user-custom-fields:key]]</label>
		<input class="form-control" type="text" name="key" value="{./key}">
	</div>

	<div class="mb-3">
		<label class="form-label">[[admin/manage/user-custom-fields:name]]</label>
		<input class="form-control" type="text" name="name" value="{./name}">
	</div>

	<div class="mb-3">
		<label class="form-label">[[admin/manage/user-custom-fields:icon]]</label>
		<div class=" d-flex gap-1">
			<input class="form-control" type="text" name="icon" value="{./icon}">
			<button id="icon-select" class="btn btn-light"><i class="fa fa-search text-primary"></i></button>
		</div>
	</div>

	<div class="mb-3">
		<label class="form-label">[[admin/manage/user-custom-fields:visibility]]</label>
		<select name="visibility" class="form-select">
			<option value="all">[[admin/manage/user-custom-fields:visibility-all]]</option>
			<option value="loggedin">[[admin/manage/user-custom-fields:visibility-loggedin]]</option>
			<option value="privileged">[[admin/manage/user-custom-fields:visibility-privileged]]</option>
		</select>
	</div>

	<div class="mb-3">
		<label class="form-label">[[admin/manage/user-custom-fields:minimum-reputation]]</label>
		<input class="form-control" type="number" name="min:rep" value="{./min:rep}" placeholder="0">
		<p class="form-text">[[admin/manage/user-custom-fields:minimum-reputation-help]]</p>
	</div>

	<div class="mb-3 {{{ if ((type != "select") && (type != "select-multi")) }}}hidden{{{ end }}}" data-input-type data-input-type-select data-input-type-select-multi>
		<label class="form-label">[[admin/manage/user-custom-fields:select-options]]</label>
		<textarea class="form-control" name="select-options" rows="6">{./select-options}</textarea>
		<p class="form-text">[[admin/manage/user-custom-fields:select-options-help]]</p>
	</div>
</form>

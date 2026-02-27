<form>
	<div class="mb-3">
		<label class="form-label">[[admin/manage/custom-reasons:reason-title]]</label>
		<input class="form-control" type="text" name="title" value="{./title}">
	</div>

	<div class="mb-3">
		<label class="form-label">[[admin/manage/custom-reasons:reason-type]]</label>
		<select class="form-select" name="type">
			<option value="" {{{ if (type == "") }}}selected{{{ end }}} >[[admin/manage/custom-reasons:reason-all]]</option>
			<option value="ban" {{{ if (type == "ban") }}}selected{{{ end }}}>[[admin/manage/custom-reasons:reason-ban]]</option>
			<option value="mute" {{{ if (type == "mute") }}}selected{{{ end }}}>[[admin/manage/custom-reasons:reason-mute]]</option>
			<option value="post-queue" {{{ if (type == "post-queue") }}}selected{{{ end }}}>[[admin/manage/custom-reasons:reason-post-queue]]</option>
		</select>
		<p class="form-text">[[admin/manage/custom-reasons:reason-type-help]]</p>
	</div>

	<div class="mb-3">
		<label class="form-label">[[admin/manage/custom-reasons:reason-body]]</label>
		<textarea rows="8" class="form-control" type="text" name="body">{./body}</textarea>
	</div>
</form>

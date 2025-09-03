<div class="topic-thumbs-modal">
	{{{ if !thumbs.length }}}
	<div class="alert alert-info">[[modules:thumbs.modal.no-thumbs]]</div>
	{{{ end }}}
	{{{ each thumbs }}}
	<div class="d-flex align-items-center mb-3" data-path="{@value}">
		<div class="flex-shrink-0 py-2">
			<img class="rounded" width="128px" style="height: auto;" src="{config.upload_url}{@value}" alt="" />
		</div>
		<div class="flex-grow-1 ms-3">
			<p>
				<code style="word-break: break-all;">{uploadBasename(@value)}</code>
			</p>
			<button class="btn btn-danger btn-sm text-nowrap" data-action="remove"><i class="fa fa-times"></i> [[modules:thumbs.modal.remove]]</button>
		</div>
	</div>
	{{{ end }}}
	<hr />
	<p class="form-text">[[modules:thumbs.modal.resize-note, {config.thumbs.size}]]</p>
</div>
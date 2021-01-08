<div class="topic-thumbs-modal">
	{{{ if !thumbs.length }}}
	<div class="alert alert-info">[[modules:thumbs.modal.no-thumbs]]</div>
	{{{ end }}}
	{{{ each thumbs }}}
	<div class="media" data-id="{./id}" data-path="{./url}">
		<div class="media-left">
			<img class="media-object" src="{config.relative_path}{./url}" />
		</div>
		<div class="media-body">
			<p>
				<code>{./name}</code>
			</p>
			<button class="btn btn-danger" data-action="remove"><i class="fa fa-times"></i> [[modules:thumbs.modal.remove]]</button>
		</div>
	</div>
	<hr />
	{{{ end }}}
	<p class="help-block">[[modules:thumbs.modal.resize-note, {config.thumbs.size}]]</p>
</div>
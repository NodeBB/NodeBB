<div class="card tool-modal shadow">
	<h5 class="card-header">
		[[topic:thread-tools.tag]]
	</h5>
	<div class="card-body d-flex flex-column gap-2">
		{{{ if tagWhitelist }}}
		<div class="d-flex flex-column gap-1">
			<span>[[tags:tag-whitelist]]</span>
			<div>
				{{{ each tagWhitelist }}}
				<span class="badge bg-info">{@value}</span>
				{{{ end }}}
			</div>
		</div>
		{{{ end }}}
		{{{ each topics }}}
		<div class="mb-3">
			<label class="form-label" for="fork-title"><strong>{./title}</strong></label>
			<input class="tags" type="text" placeholder="[[tags:enter-tags-here, {config.minimumTagLength}, {config.maximumTagLength}]]" />
		</div>
		{{{ end }}}
	</div>
	<div class="card-footer text-end">
		<button class="btn btn-link btn-sm" id="tag-topic-cancel">[[global:buttons.close]]</button>
		<button class="btn btn-primary btn-sm" id="tag-topic-commit">[[global:save]]</button>
	</div>
</div>
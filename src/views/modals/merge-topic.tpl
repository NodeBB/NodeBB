<div class="tool-modal d-flex">
	<div class="card shadow">
		<h5 class="card-header">[[topic:thread-tools.merge-topics]]</h5>
		<div class="card-body">
			<p>
				[[topic:merge-topics-instruction]]
			</p>
			<p>
				<div class="input-group">
					<input class="form-control topic-search-input" type="text">
					<span class="input-group-text"><i class="fa fa-search"></i></span>
				</div>

				<div class="quick-search-container dropdown-menu d-block p-2 hidden">
					<div class="text-center loading-indicator"><i class="fa fa-spinner fa-spin"></i></div>
					<div class="quick-search-results-container"></div>
				</div>
			</p>

			<p><strong>[[topic:merge-topic-list-title]]</strong></p>
			<ul class="topics-section">
				{{{ each topics }}}
				<li class="mb-1">
					<div class="d-flex justify-content-between align-items-center gap-2">
						<a href="{config.relative_path}/topic/{./tid}"><strong>{./title}</strong></a>
						<button class="btn btn-sm btn-light" data-remove-tid="{./tid}"><i class="fa fa-times text-danger"></i></button>
					</div>
				</li>
				{{{ end }}}
			</ul>
			<p>
				<strong>[[topic:merge-options]]</strong>
			</p>
			<form>
				<p>
					<input class="merge-main-topic-radio" type="radio" name="merge-topic-option" checked="true"> [[topic:merge-select-main-topic]]
				</p>
				<p>
					<select class="form-select merge-main-topic-select">
						{{{ each topics }}}
						<option value="{topics.tid}">{topics.title}</option>
						{{{ end }}}
					</select>
				</p>
				<p>
					<input class="merge-new-title-radio" type="radio" name="merge-topic-option"> [[topic:merge-new-title-for-topic]]
				</p>
				<p>
					<input class="merge-new-title-input form-control" type="text">
				</p>
			</form>
		</div>
		<div class="card-footer text-end">
			<button class="btn btn-link btn-sm" id="merge_topics_cancel">[[global:buttons.close]]</button>
			<button class="btn btn-primary btn-sm" id="merge_topics_confirm" disabled>[[topic:thread-tools.merge]]</button>
		</div>
	</div>
</div>
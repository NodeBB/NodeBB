<div class="card tool-modal shadow">
	<h5 class="card-header">
		[[topic:fork-topic]]
	</h5>
	<div class="card-body">
		<p>
			[[topic:fork-topic-instruction]]
		</p>
		<div class="mb-3">
			<label class="form-label" for="fork-title"><strong>[[topic:title]]</strong></label>
			<input id="fork-title" type="text" class="form-control" placeholder="[[topic:enter-new-topic-title]]">
		</div>
		<div class="mb-3">
			<label class="form-label"><strong>[[category:category]]</strong></label>
			<div>
			<!-- IMPORT partials/category/selector-dropdown-right.tpl -->
			</div>
		</div>
		<strong id="fork-pids"></strong>
	</div>
	<div class="card-footer text-end">
		<button class="btn btn-link btn-sm" id="fork_thread_cancel">[[global:buttons.close]]</button>
		<button class="btn btn-primary btn-sm" id="fork_thread_commit" disabled>[[topic:fork-topic]]</button>
	</div>
</div>
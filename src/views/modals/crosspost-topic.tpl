<div class="card tool-modal shadow">
	<h5 class="card-header">
		{{tx("topic:crosspost-topic")}}
	</h5>
	<div class="card-body">
		<p>
			{{tx("topic:crossposts.instructions")}}
		</p>
		<!-- IMPORT partials/category/filter-dropdown-right.tpl -->
	</div>
	<div class="card-footer text-end">
		<i class="fa me-2" id="crosspost_topic_spinner"></i>
		<button type="button" class="btn btn-sm btn-outline-secondary" id="crosspost_topic_cancel">{{tx("global:buttons.close")}}</button>
		<button type="button" class="btn btn-sm btn-primary" id="crosspost_thread_commit" disabled>{{tx("topic:confirm-crosspost")}}</button>
	</div>
</div>
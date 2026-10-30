<div class="card tool-modal shadow">
	<h5 class="card-header">
		{{tx("topic:move-topic")}}
	</h5>
	<div class="card-body">
		<p>
			{{tx("topic:move-topic-instruction")}}
		</p>
		<!-- IMPORT partials/category/selector-dropdown-right.tpl -->
	</div>
	<div class="card-footer text-end">
		<button type="button" class="btn btn-sm btn-outline-secondary" id="move_topic_cancel">{{tx("global:buttons.close")}}</button>
		<button type="button" class="btn btn-sm btn-primary" id="move_thread_commit" disabled>{{tx("topic:confirm-move")}}</button>
	</div>
</div>
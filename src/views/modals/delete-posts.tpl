<div class="card tool-modal shadow">
	<h5 class="card-header">
		{{tx("topic:thread-tools.delete-posts")}}
	</h5>
	<div class="card-body">
		<p>
			{{tx("topic:delete-posts-instruction")}}
		</p>
		<p><strong><span id="pids"></span></strong></p>
	</div>
	<div class="card-footer text-end">
		<button class="btn btn-link btn-sm" id="delete_posts_cancel">{{tx("global:buttons.close")}}</button>
		<button class="btn btn-primary btn-sm" id="delete_posts_confirm" disabled>{{tx("topic:delete")}}</button>
		<button class="btn btn-danger btn-sm" id="purge_posts_confirm" disabled>{{tx("topic:purge")}}</button>
	</div>
</div>
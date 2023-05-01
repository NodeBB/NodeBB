<div class="outgoing d-flex flex-column gap-3">
	<!-- IMPORT partials/breadcrumbs.tpl -->
	<div class="card card-header p-3 border-0 shadow-none mb-3 gap-2">
		<h4>
			[[notifications:outgoing_link_message, {title}]]
		</h4>
		<div class="d-flex flex-column gap-2">
			<a href="{outgoing}" rel="nofollow noopener noreferrer" class="btn btn-primary text-truncate">[[notifications:continue_to, {outgoing}]]</a>
			<a href="#" class="btn btn-warning" onclick="history.back(); return false;">[[notifications:return_to, {title}]]</a>
		</div>
	</div>
</div>
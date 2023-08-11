<div class="logs settings d-flex flex-column gap-2 px-lg-4">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/advanced/logs:logs]]</h4>
		</div>
		<div class="d-flex align-items-center gap-1">
			<button class="btn btn-sm btn-light text-nowrap" data-action="clear">
				<i class="fa fa-trash text-danger"></i> [[admin/advanced/logs:clear]]
			</button>
			<button class="btn btn-sm btn-light text-nowrap" data-action="reload">
				<i class="fa fa-refresh text-primary"></i> [[admin/advanced/logs:reload]]
			</button>
		</div>
	</div>

	<div class="card">
		<div class="card-body">
			<pre class="text-break" style="height: 600px; white-space: break-spaces;">{data}</pre>
		</div>
	</div>
</div>


<div class="post-cache settings d-flex flex-column gap-2 px-lg-4">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/advanced/cache:cache]]</h4>
		</div>
		<div class="d-flex align-items-center">
			<button id="save" class="btn btn-primary btn-sm fw-semibold ff-secondary w-100 text-center text-nowrap">[[admin/admin:save-changes]]</button>
		</div>
	</div>


	<div class="row px-2">
		{{{each caches}}}
		<div class="col-xl-3">
			<div class="card">
				<div class="card-header">[[admin/advanced/cache:{@key}-cache]]</div>
				<div class="card-body">
					<div class="form-check form-switch mb-3" data-name="{@key}">
						<input class="form-check-input" type="checkbox" {{{if caches.enabled}}}checked{{{end}}}>
					</div>

					<div class="mb-3">{{{if ./length}}}{./length}{{{else}}}{./itemCount}{{{end}}} / {{{if ./max}}}{./max}{{{else}}}{./maxSize}{{{end}}}</div>
					<div class="progress mb-3" style="height:20px;">
						<div class="progress-bar" role="progressbar" aria-valuenow="{./percentFull}" aria-valuemin="0" aria-valuemax="100" style="width: {./percentFull}%;">
							[[admin/advanced/cache:percent-full, {./percentFull}]]
						</div>
					</div>
					<div class="mb-2">
						<label>Hits:</label> <span>{./hits}</span>
					</div>
					<div class="mb-2">
						<label>Misses:</label> <span>{./misses}</span>
					</div>
					<div class="mb-2">
						<label>Hit Ratio:</label> <span>{./hitRatio}</span>
					</div>
					<div class="mb-2">
						<label>Hits / Sec:</label> <span>{./hitsPerSecond}</span>
					</div>

					{{{if ./ttl}}}
					<div class="mb-2">
						<label>TTL:</label> <span>{./ttl}</span>
					</div>
					{{{end}}}
					{{{if (@key == "post")}}}
					<hr/>
					<div class="mb-3">
						<label for="postCacheSize">[[admin/advanced/cache:post-cache-size]]</label>
						<input id="postCacheSize" type="text" class="form-control" value="" data-field="postCacheSize">
					</div>
					{{{end}}}
					<a href="{config.relative_path}/api/admin/advanced/cache/dump?name={@key}" class="btn btn-light btn-sm"><i class="fa fa-download"></i></a>
					<a class="btn btn-sm btn-danger clear" data-name="{@key}"><i class="fa fa-trash"></i></a>
				</div>
			</div>
		</div>
		{{{end}}}
	</div>
</div>


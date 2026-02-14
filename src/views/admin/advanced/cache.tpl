
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
		{{{ each caches }}}
		<div class="col-xl-3">
			<div class="card">
				<div class="card-header">
					<div class="d-flex gap-2 justify-content-between align-items-center">
						<div class="d-flex gap-1 align-items-center">
							<div class="form-check form-switch text-sm" data-name="{@key}" style="min-height: initial;">
								<input class="form-check-input" type="checkbox" {{{if caches.enabled}}}checked{{{end}}}>
							</div>
							[[admin/advanced/cache:{@key}-cache]]
						</div>
						<div class="d-flex gap-1">
							<a href="{config.relative_path}/api/admin/advanced/cache/dump?name={@key}" class="btn btn-light btn-sm"><i class="fa fa-download"></i></a>
							<a class="btn btn-sm btn-danger clear" data-name="{@key}"><i class="fa fa-trash"></i></a>
						</div>
					</div>
				</div>
				<div class="card-body">
					<div class="progress mb-3" style="height:20px;">
						<div class="progress-bar" role="progressbar" aria-valuenow="{./percentFull}" aria-valuemin="0" aria-valuemax="100" style="width: {./percentFull}%;">
							[[admin/advanced/cache:percent-full, {./percentFull}]]
						</div>
					</div>

					<div class="mb-2">
						<label>Size:</label> <span class="fw-bold">{{{if ./length}}}{./length}{{{else}}}{./itemCount}{{{end}}} / {{{if ./max}}}{./max}{{{else}}}{./maxSize}{{{end}}}</span>
					</div>

					<div class="mb-2">
						<label>Hits:</label> <span class="fw-bold">{./hits}</span>
					</div>
					<div class="mb-2">
						<label>Misses:</label> <span class="fw-bold">{./misses}</span>
					</div>
					<div class="mb-2">
						<label>Hit Ratio:</label> <span class="fw-bold">{./hitRatio}</span>
					</div>
					<div class="mb-2">
						<label>Hits / Sec:</label> <span class="fw-bold">{./hitsPerSecond}</span>
					</div>

					{{{ if ./ttl }}}
					<div class="mb-2">
						<label>TTL:</label> <span class="fw-bold">{./ttl}</span>
					</div>
					{{{ end }}}
					{{{ if (@key == "post") }}}
					<hr/>
					<div class="mb-3">
						<label for="postCacheSize">[[admin/advanced/cache:post-cache-size]]</label>
						<input id="postCacheSize" type="text" class="form-control" value="" data-field="postCacheSize">
					</div>
					{{{ end }}}

				</div>
			</div>
		</div>
		{{{ end }}}
	</div>
</div>


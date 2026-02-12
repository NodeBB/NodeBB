
<div class="post-cache settings d-flex flex-column gap-2 px-lg-4">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/advanced/cache:cache]]</h4>
		</div>
		<div class="d-flex align-items-center">
			<button id="save" class="btn btn-primary btn-sm fw-semibold ff-secondary w-100 text-center text-nowrap">[[admin/admin:save-changes]]</button>
		</div>
	</div>

	<div>
		<div class="table-responsive">
				<table class="table table-sm text-sm">
					<thead>
						<tr>
							<td></td>
							<td class="text-end">capacity</td>
							<td class="text-end">count</td>
							<td class="text-end">size</td>
							<td class="text-end">hits</td>
							<td class="text-end">misses</td>
							<td class="text-end">hit ratio</td>
							<td class="text-end">hits/sec</td>
							<td class="text-end">ttl</td>
							<td></td>
						</tr>
					</thead>
					<tbody class="text-xs">
					{{{ each caches }}}
					<tr class="align-middle">
						<td>
							<div class="d-flex gap-1 align-items-center">
								<div class="form-check form-switch text-sm" data-name="{@key}" style="min-height: initial;">
									<input class="form-check-input" type="checkbox" {{{if caches.enabled}}}checked{{{end}}}>
								</div>
								[[admin/advanced/cache:{@key}-cache]]
							</div>
						</td>
						<td class="text-end">{./percentFull}%</td>
						<td class="text-end">{{{if ./length}}}{./length}{{{else}}}{./itemCount}{{{end}}} </td>
						<td class="text-end">
							{{{ if (@key == "post") }}}
							<div class="d-flex justify-content-end align-items-center gap-1">
							<a href="#" data-bs-toggle="tooltip" data-bs-title="Changing the post cache size requires a restart."><i class="fa-regular fa-circle-question"></i></a>

							<input id="postCacheSize" style="width:100px;" type="text" class="text-end form-control form-control-sm" value="" data-field="postCacheSize">

							</div>
							{{{ else }}}
							{{{if ./max}}}{./max}{{{else}}}{./maxSize}{{{end}}}
							{{{ end }}}
						</td>
						<td class="text-end">{./hits}</td>
						<td class="text-end">{./misses}</td>
						<td class="text-end">{./hitRatio}</td>
						<td class="text-end">{./hitsPerSecond}</td>
						<td class="text-end">{./ttl}</td>
						<td class="">
							<div class="d-flex justify-content-end gap-1">
								<a href="{config.relative_path}/api/admin/advanced/cache/dump?name={@key}" class="btn btn-light btn-sm"><i class="fa fa-download"></i></a>
								<a class="btn btn-sm btn-danger clear" data-name="{@key}"><i class="fa fa-trash"></i></a>
							</div>
						</td>
					</tr>
					{{{ end }}}
					</tbody>
				</table>
			</div>
	</div>
</div>


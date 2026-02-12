
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
				<table id="cache-table" class="table table-sm text-sm">
					<thead>
						<tr>
							<th><a href="#" class="text-reset">name</a> <i class="fa-solid invisible fa-sort-down"></i></th>
							<th class="text-end"><a href="#" class="text-reset">capacity</a> <i class="fa-solid invisible fa-sort-down"></i></th>
							<th class="text-end"><a href="#" class="text-reset">count</a> <i class="fa-solid invisible fa-sort-down"></i></th>
							<th class="text-end"><a href="#" class="text-reset">size</a> <i class="fa-solid invisible fa-sort-down"></i></th>
							<th class="text-end"><a href="#" class="text-reset">hits</a> <i class="fa-solid fa-sort-down"></i></th>
							<th class="text-end"><a href="#" class="text-reset">misses</a> <i class="fa-solid invisible fa-sort-down"></i></th>
							<th class="text-end"><a href="#" class="text-reset">hit ratio</a> <i class="fa-solid invisible fa-sort-down"></i></th>
							<th class="text-end"><a href="#" class="text-reset">hits/sec</a> <i class="fa-solid invisible fa-sort-down"></i></th>
							<th class="text-end"><a href="#" class="text-reset">ttl</a> <i class="fa-solid invisible fa-sort-down"></i></th>
							<th></td>
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
								{./name}
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
								<a href="{config.relative_path}/api/admin/advanced/cache/dump?name={./name}" class="btn btn-light btn-sm"><i class="fa fa-download"></i></a>
								<a class="btn btn-sm btn-danger clear" data-name="{./name}"><i class="fa fa-trash"></i></a>
							</div>
						</td>
					</tr>
					{{{ end }}}
					</tbody>
				</table>
			</div>
	</div>
</div>


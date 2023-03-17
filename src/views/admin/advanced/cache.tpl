<!-- IMPORT admin/partials/settings/header.tpl -->
<div class="row post-cache">
	<div class="col-lg-12">
		<div class="row">
			{{{each caches}}}
			<div class="col-lg-3">
				<div class="card">
					<div class="card-header">[[admin/advanced/cache:{@key}-cache]]</div>
					<div class="card-body">
						<div class="form-check form-switch mb-3" data-name="{@key}">
							<input class="form-check-input" type="checkbox" {{{if caches.enabled}}}checked{{{end}}}>
						</div>

						<div class="mb-3">{{{if ../length}}}{../length}{{{else}}}{../itemCount}{{{end}}} / {{{if ../max}}}{../max}{{{else}}}{../maxSize}{{{end}}}</div>
						<div class="progress mb-3" style="height:20px;">
							<div class="progress-bar" role="progressbar" aria-valuenow="{../percentFull}" aria-valuemin="0" aria-valuemax="100" style="width: {../percentFull}%;">
								[[admin/advanced/cache:percent-full, {../percentFull}]]
							</div>
						</div>
						<div class="mb-2">
							<label>Hits:</label> <span>{../hits}</span>
						</div>
						<div class="mb-2">
							<label>Misses:</label> <span>{../misses}</span>
						</div>
						<div class="mb-2">
							<label>Hit Ratio:</label> <span>{../hitRatio}</span>
						</div>

						{{{if ../ttl}}}
						<div class="mb-2">
							<label>TTL:</label> <span>{../ttl}</span>
						</div>
						{{{end}}}
						{{{if (@key == "post")}}}
						<hr/>
						<div class="mb-3">
							<label for="postCacheSize">[[admin/advanced/cache:post-cache-size]]</label>
							<input id="postCacheSize" type="text" class="form-control" value="" data-field="postCacheSize">
						</div>
						{{{end}}}
						<a href="{config.relative_path}/api/admin/advanced/cache/dump?name={@key}" class="btn btn-sm"><i class="fa fa-download"></i></a>
						<a class="btn btn-sm btn-danger clear" data-name="{@key}"><i class="fa fa-trash"></i></a>
					</div>
				</div>
			</div>
			{{{end}}}
		</div>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->

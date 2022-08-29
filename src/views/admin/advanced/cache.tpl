<!-- IMPORT admin/partials/settings/header.tpl -->
<div class="row post-cache">
	<div class="col-lg-12">
		<div class="row">
			{{{each caches}}}
			<div class="col-lg-3">
				<div class="panel panel-default">
					<div class="panel-heading">[[admin/advanced/cache:{@key}-cache]]</div>
					<div class="panel-body">
						<div class="checkbox" data-name="{@key}">
							<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
								<input class="mdl-switch__input" type="checkbox" {{{if caches.enabled}}}checked{{{end}}}>
							</label>
						</div>

						<span>{{{if ../length}}}{../length}{{{else}}}{../itemCount}{{{end}}} / {{{if ../max}}}{../max}{{{else}}}{../maxSize}{{{end}}}</span><br/>

						<div class="progress">
							<div class="progress-bar" role="progressbar" aria-valuenow="{../percentFull}" aria-valuemin="0" aria-valuemax="100" style="width: {../percentFull}%;">
								[[admin/advanced/cache:percent-full, {../percentFull}]]
							</div>
						</div>

						<label>Hits:</label> <span>{../hits}</span><br/>
						<label>Misses:</label> <span>{../misses}</span><br/>
						<label>Hit Ratio:</label> <span>{../hitRatio}</span><br/>
						{{{if ../ttl}}}<label>TTL:</label> <span>{../ttl}</span></br>{{{end}}}
						{{{if (@key == "post")}}}
						<hr/>
						<div class="form-group">
							<label for="postCacheSize">[[admin/advanced/cache:post-cache-size]]</label>
							<input id="postCacheSize" type="text" class="form-control" value="" data-field="postCacheSize">
						</div>
						{{{end}}}
						<a href="{config.relative_path}/api/admin/advanced/cache/dump?name={@key}" class="btn btn-sm btn-default"><i class="fa fa-download"></i></a>
						<a class="btn btn-sm btn-danger clear" data-name="{@key}"><i class="fa fa-trash"></i></a>
					</div>
				</div>
			</div>
			{{{end}}}
			
		</div>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->

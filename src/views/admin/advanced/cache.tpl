
<div class="row post-cache">
	<div class="col-lg-12">
		<div class="row">
			<div class="col-lg-3">
				<div class="panel panel-default">
					<div class="panel-heading">[[admin/advanced/cache:post-cache]]</div>
					<div class="panel-body">
						<div class="checkbox" data-name="post">
							<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
								<input class="mdl-switch__input" type="checkbox" {{{if postCache.enabled}}}checked{{{end}}}>
							</label>
						</div>

						<span>{postCache.length} / {postCache.max}</span><br/>

						<div class="progress">
							<div class="progress-bar" role="progressbar" aria-valuenow="{postCache.percentFull}" aria-valuemin="0" aria-valuemax="100" style="width: {postCache.percentFull}%;">
								[[admin/advanced/cache:percent-full, {postCache.percentFull}]]
							</div>
						</div>

						<label>Hits:</label> <span>{postCache.hits}</span><br/>
						<label>Misses:</label> <span>{postCache.misses}</span><br/>
						<label>Hit Ratio:</label> <span>{postCache.hitRatio}</span><br/>

						<hr/>

						<div class="form-group">
							<label for="postCacheSize">[[admin/advanced/cache:post-cache-size]]</label>
							<input id="postCacheSize" type="text" class="form-control" value="" data-field="postCacheSize">
						</div>
						<a href="{config.relative_path}/api/admin/advanced/cache/dump?name=post" class="btn btn-sm btn-default"><i class="fa fa-download"></i></a>
						<a class="btn btn-sm btn-danger clear" data-name="post"><i class="fa fa-trash"></i></a>
					</div>
				</div>
			</div>

			<!-- IF objectCache -->
			<div class="col-lg-3">
				<div class="panel panel-default">
					<div class="panel-heading">Object Cache</div>
					<div class="panel-body">
						<div class="checkbox" data-name="object">
							<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
								<input class="mdl-switch__input" type="checkbox" {{{if objectCache.enabled}}}checked{{{end}}}>
							</label>
						</div>
						<span>{objectCache.length} / {objectCache.max}</span><br/>
						<div class="progress">
							<div class="progress-bar" role="progressbar" aria-valuenow="{objectCache.percentFull}" aria-valuemin="0" aria-valuemax="100" style="width: {objectCache.percentFull}%;">
								[[admin/advanced/cache:percent-full, {objectCache.percentFull}]]
							</div>
						</div>

						<label>Hits:</label> <span>{objectCache.hits}</span><br/>
						<label>Misses:</label> <span>{objectCache.misses}</span><br/>
						<label>Hit Ratio:</label> <span>{objectCache.hitRatio}</span><br/>
						<a href="{config.relative_path}/api/admin/advanced/cache/dump?name=object" class="btn btn-sm btn-default"><i class="fa fa-download"></i></a>
						<a class="btn btn-sm btn-danger clear" data-name="object"><i class="fa fa-trash"></i></a>
					</div>
				</div>
			</div>
			<!-- ENDIF objectCache -->

			<div class="col-lg-3">
				<div class="panel panel-default">
					<div class="panel-heading">Group Cache</div>
					<div class="panel-body">
						<div class="checkbox" data-name="group">
							<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
								<input class="mdl-switch__input" type="checkbox" {{{if groupCache.enabled}}}checked{{{end}}}>
							</label>
						</div>
						<span>{groupCache.length} / {groupCache.max}</span><br/>

						<div class="progress">
							<div class="progress-bar" role="progressbar" aria-valuenow="{groupCache.percentFull}" aria-valuemin="0" aria-valuemax="100" style="width: {groupCache.percentFull}%;">
								[[admin/advanced/cache:percent-full, {groupCache.percentFull}]]
							</div>
						</div>

						<label>Hits:</label> <span>{groupCache.hits}</span><br/>
						<label>Misses:</label> <span>{groupCache.misses}</span><br/>
						<label>Hit Ratio:</label> <span>{groupCache.hitRatio}</span><br/>
						<a href="{config.relative_path}/api/admin/advanced/cache/dump?name=group" class="btn btn-sm btn-default"><i class="fa fa-download"></i></a>
						<a class="btn btn-sm btn-danger clear" data-name="group"><i class="fa fa-trash"></i></a>
					</div>
				</div>
			</div>

			<div class="col-lg-3">
				<div class="panel panel-default">
					<div class="panel-heading">Local Cache</div>
					<div class="panel-body">
						<div class="checkbox" data-name="local">
							<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
								<input class="mdl-switch__input" type="checkbox" {{{if localCache.enabled}}}checked{{{end}}}>
							</label>
						</div>
						<span>{localCache.length} / {localCache.max}</span><br/>

						<div class="progress">
							<div class="progress-bar" role="progressbar" aria-valuenow="{localCache.percentFull}" aria-valuemin="0" aria-valuemax="100" style="width: {localCache.percentFull}%;">
								[[admin/advanced/cache:percent-full, {localCache.percentFull}]]
							</div>
						</div>

						<label>Hits:</label> <span>{localCache.hits}</span><br/>
						<label>Misses:</label> <span>{localCache.misses}</span><br/>
						<label>Hit Ratio:</label> <span>{localCache.hitRatio}</span><br/>
						<a href="{config.relative_path}/api/admin/advanced/cache/dump?name=local" class="btn btn-sm btn-default"><i class="fa fa-download"></i></a>
						<a class="btn btn-sm btn-danger clear" data-name="local"><i class="fa fa-trash"></i></a>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>


<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
    <i class="material-icons">save</i>
</button>

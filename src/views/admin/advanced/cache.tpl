
<div class="row post-cache">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-calendar-o"></i> [[admin/advanced/cache:post-cache]]</div>
			<div class="panel-body">
				<label>[[admin/advanced/cache:posts-in-cache]]</label><br/>
				<span>{postCache.itemCount}</span><br/>

				<label>[[admin/advanced/cache:average-post-size]]</label><br/>
				<span>{postCache.avgPostSize}</span><br/>

				<label>[[admin/advanced/cache:length-to-max]]</label><br/>
				<span>{postCache.length} / {postCache.max}</span><br/>

				<div class="progress">
					<div class="progress-bar" role="progressbar" aria-valuenow="{postCache.percentFull}" aria-valuemin="0" aria-valuemax="100" style="width: {postCache.percentFull}%;">
						[[admin/advanced/cache:percent-full, {postCache.percentFull}]]
					</div>
				</div>

				<label>Hits:</label> <span>{postCache.hits}</span><br/>
				<label>Misses:</label> <span>{postCache.misses}</span><br/>
				<label>Hit Ratio:</label> <span>{postCache.hitRatio}</span><br/>

				<div class="form-group">
					<label for="postCacheSize">[[admin/advanced/cache:post-cache-size]]</label>
					<input id="postCacheSize" type="text" class="form-control" value="" data-field="postCacheSize">
				</div>
			</div>
		</div>

		<!-- IF objectCache -->
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-calendar-o"></i> Object Cache</div>
			<div class="panel-body">
				<label>[[admin/advanced/cache:length-to-max]]</label><br/>
				<span>{objectCache.length} / {objectCache.max}</span><br/>
				<div class="progress">
					<div class="progress-bar" role="progressbar" aria-valuenow="{objectCache.percentFull}" aria-valuemin="0" aria-valuemax="100" style="width: {objectCache.percentFull}%;">
						[[admin/advanced/cache:percent-full, {objectCache.percentFull}]]
					</div>
				</div>

				<label>Hits:</label> <span>{objectCache.hits}</span><br/>
				<label>Misses:</label> <span>{objectCache.misses}</span><br/>
				<label>Hit Ratio:</label> <span>{objectCache.hitRatio}</span><br/>
			</div>
		</div>
		<!-- ENDIF objectCache -->

		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-calendar-o"></i> Group Cache</div>
			<div class="panel-body">

				<label>[[admin/advanced/cache:length-to-max]]</label><br/>
				<span>{groupCache.length} / {groupCache.max}</span><br/>

				<div class="progress">
					<div class="progress-bar" role="progressbar" aria-valuenow="{groupCache.percentFull}" aria-valuemin="0" aria-valuemax="100" style="width: {groupCache.percentFull}%;">
						[[admin/advanced/cache:percent-full, {groupCache.percentFull}]]
					</div>
				</div>

				<label>Hits:</label> <span>{groupCache.hits}</span><br/>
				<label>Misses:</label> <span>{groupCache.misses}</span><br/>
				<label>Hit Ratio:</label> <span>{groupCache.hitRatio}</span><br/>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-calendar-o"></i> Local Cache</div>
			<div class="panel-body">

				<label>[[admin/advanced/cache:length-to-max]]</label><br/>
				<span>{localCache.length} / {localCache.max}</span><br/>

				<div class="progress">
					<div class="progress-bar" role="progressbar" aria-valuenow="{localCache.percentFull}" aria-valuemin="0" aria-valuemax="100" style="width: {localCache.percentFull}%;">
						[[admin/advanced/cache:percent-full, {localCache.percentFull}]]
					</div>
				</div>

				<label>Hits:</label> <span>{localCache.hits}</span><br/>
				<label>Misses:</label> <span>{localCache.misses}</span><br/>
				<label>Hit Ratio:</label> <span>{localCache.hitRatio}</span><br/>

				<!-- IF localCache.dump -->
				<pre>{localCache.dump}</pre>
				<!-- ENDIF localCache.dump -->

			</div>
		</div>
	</div>
	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin/advanced/cache:control-panel]]</div>
			<div class="panel-body">
				<button class="btn btn-primary" id="save">[[admin/advanced/cache:update-settings]]</button>
			</div>
		</div>
	</div>
</div>

<script>
	require(['admin/settings'], function(Settings) {
		Settings.prepare();
	});
</script>

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
				<div class="form-group">
					<label for="postCacheSize">[[admin/advanced/cache:post-cache-size]]</label>
					<input id="postCacheSize" type="text" class="form-control" value="" data-field="postCacheSize">
				</div>
			</div>
		</div>

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

				<!-- IF objectCache.dump -->
				<pre>{objectCache.dump}</pre>
				<!-- ENDIF objectCache.dump -->
			</div>
		</div>

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

				<!-- IF groupCache.dump -->
				<pre>{groupCache.dump}</pre>
				<!-- ENDIF groupCache.dump -->

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

<div class="post-cache">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-calendar-o"></i> Post Cache</div>
			<div class="panel-body">

				<label>Posts in Cache</label><br/>
				<span>{postCache.itemCount}</span><br/>

				<label>Average Post Size</label><br/>
				<span>{postCache.avgPostSize}</span><br/>

				<label>Length / Max</label><br/>
				<span>{postCache.length} / {postCache.max}</span><br/>

				<div class="progress">
					<div class="progress-bar" role="progressbar" aria-valuenow="{postCache.percentFull}" aria-valuemin="0" aria-valuemax="100" style="width: {postCache.percentFull}%;">
						{postCache.percentFull}% Full
					</div>
				</div>

				<!-- IF postCache.dump -->
				<pre>{postCache.dump}</pre>
				<!-- ENDIF postCache.dump -->

			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-calendar-o"></i> Group Cache</div>
			<div class="panel-body">

				<label>Users in Cache</label><br/>
				<span>{groupCache.itemCount}</span><br/>

				<label>Length / Max</label><br/>
				<span>{groupCache.length} / {groupCache.max}</span><br/>

				<div class="progress">
					<div class="progress-bar" role="progressbar" aria-valuenow="{groupCache.percentFull}" aria-valuemin="0" aria-valuemax="100" style="width: {groupCache.percentFull}%;">
						{groupCache.percentFull}% Full
					</div>
				</div>

				<!-- IF groupCache.dump -->
				<pre>{groupCache.dump}</pre>
				<!-- ENDIF groupCache.dump -->

			</div>
		</div>
	</div>

</div>


<div class="post-cache">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-calendar-o"></i> Post Cache</div>
			<div class="panel-body" data-next="{next}">

				<label>Posts in Cache</label><br/>
				<span>{cache.itemCount}</span><br/>

				<label>Average Post Size</label><br/>
				<span>{cache.avgPostSize}</span><br/>

				<label>Length / Max</label><br/>
				<span>{cache.length} / {cache.max}</span><br/>

				<div class="progress">
					<div class="progress-bar" role="progressbar" aria-valuenow="{cache.percentFull}" aria-valuemin="0" aria-valuemax="100" style="width: {cache.percentFull}%;">
						{cache.percentFull}% Full
					</div>
				</div>

			</div>
		</div>
	</div>

</div>

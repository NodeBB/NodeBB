<div class="row ip-blacklist">
	<div class="col-lg-12">
		<p class="lead">
			[[admin/manage/ip-blacklist:lead]]
		</p>
		<p>
			[[admin/manage/ip-blacklist:description]]
		</p>

		<div class="row">
			<div class="col-sm-6">
				<div class="panel panel-default">
					<div class="panel-heading">[[admin/manage/ip-blacklist:active-rules]]</div>
					<div class="panel-body">
						<textarea id="blacklist-rules">{rules}</textarea><br />
						<button type="button" class="btn btn-warning" data-action="test">
							<i class="fa fa-bomb"></i> [[admin/manage/ip-blacklist:validate]]
						</button>
						<button type="button" class="btn btn-primary" data-action="apply">
							<i class="fa fa-save"></i> [[admin/manage/ip-blacklist:apply]]
						</button>
					</div>
				</div>
				<div class="panel panel-default">
					<div class="panel-heading">[[admin/manage/ip-blacklist:hints]]</div>
					<div class="panel-body">
						<p>
							[[admin/manage/ip-blacklist:hint-1]]
						</p>
						<p>
							[[admin/manage/ip-blacklist:hint-2]]
						</p>
					</div>
				</div>
			</div>
			<div class="col-sm-6">
				<div class="panel panel-default">
					<div class="panel-body">
						<div><canvas id="blacklist:hourly" height="250"></canvas></div>
					</div>
					<div class="panel-footer"><small>[[admin/manage/ip-blacklist:analytics.blacklist-hourly]]</small></div>
				</div>
					
				<div class="panel panel-default">
					<div class="panel-body">
						<div><canvas id="blacklist:daily" height="250"></canvas></div>
					</div>
					<div class="panel-footer"><small>[[admin/manage/ip-blacklist:analytics.blacklist-daily]]</small></div>
				</div>
			</div>
		</div>
	</div>

</div>
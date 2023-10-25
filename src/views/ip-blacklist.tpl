<div class="row ip-blacklist">
	<div class="col-lg-12">
		<p class="lead">
			[[ip-blacklist:lead]]
		</p>
		<p>
			[[ip-blacklist:description]]
		</p>

		<div class="row">
			<div class="col-sm-6 d-flex flex-column">
				<div class="card mb-3 flex-grow-1">
					<div class="card-header">[[ip-blacklist:active-rules]]</div>
					<div class="card-body d-flex flex-column">
						<textarea id="blacklist-rules" class="flex-grow-1 mb-3 w-100 d-block border px-2 py-1">{rules}</textarea>
						<div>
							<button type="button" class="btn btn-warning" data-action="test">
								<i class="fa fa-bomb"></i> [[ip-blacklist:validate]]
							</button>
							<button type="button" class="btn btn-primary" data-action="apply">
								<i class="fa fa-save"></i> [[ip-blacklist:apply]]
							</button>
						</div>
					</div>
				</div>
				<div class="card flex-shrink-1">
					<div class="card-header">[[ip-blacklist:hints]]</div>
					<div class="card-body">
						<p>
							[[ip-blacklist:hint-1]]
						</p>
						<p>
							[[ip-blacklist:hint-2]]
						</p>
					</div>
				</div>
			</div>
			<div class="col-sm-6">
				<div class="card mb-3">
					<div class="card-body">
						<div class="position-relative" style="aspect-ratio: 2; max-height: initial;">
							<canvas id="blacklist:hourly" style="max-height: initial;"></canvas>
						</div>
					</div>
					<div class="card-footer"><small>[[ip-blacklist:analytics.blacklist-hourly]]</small></div>
				</div>

				<div class="card">
					<div class="card-body">
						<div class="position-relative" style="aspect-ratio: 2; max-height: initial;">
							<canvas id="blacklist:daily" style="max-height: initial;"></canvas>
						</div>
					</div>
					<div class="card-footer"><small>[[ip-blacklist:analytics.blacklist-daily]]</small></div>
				</div>
			</div>
		</div>
	</div>

</div>
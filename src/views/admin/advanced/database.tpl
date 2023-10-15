<div class="acp-page-container">
	<div class="row database">
		{{{ if mongo }}}
		<div class="{{{ if redis }}}col-lg-6{{{ else }}}col-lg-12{{{ end }}}">
			{{{ if mongo.serverStatusError }}}
			<div class="alert alert-warning">
				{mongo.serverStatusError}
			</div>
			{{{ end }}}
			<div class="card">
				<div class="card-header"><i class="fa fa-hdd-o"></i> [[admin/advanced/database:mongo]]</div>
				<div class="card-body">
					<div class="database-info">
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:mongo.version]]</span> <span class="text-end">{mongo.version}</span></div>
						<hr/>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:uptime-seconds]]</span> <span class="text-end">{formattedNumber(mongo.uptime)}</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:mongo.storage-engine]]</span> <span class="text-end">{mongo.storageEngine}</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:mongo.collections]]</span> <span class="text-end">{formattedNumber(mongo.collections)}</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:mongo.objects]]</span> <span class="text-end">{formattedNumber(mongo.objects)}</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:mongo.avg-object-size]]</span> <span class="text-end">[[admin/advanced/database:x-b, {mongo.avgObjSize}]]</span></div>
						<hr/>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:mongo.data-size]]</span> <span class="text-end">[[admin/advanced/database:x-gb, {mongo.dataSize}]]</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:mongo.storage-size]]</span> <span class="text-end">[[admin/advanced/database:x-gb, {mongo.storageSize}]]</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:mongo.index-size]]</span> <span class="text-end">[[admin/advanced/database:x-gb, {mongo.indexSize}]]</span></div>
						{{{ if mongo.fileSize }}}
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:mongo.file-size]]</span> <span class="text-end">[[admin/advanced/database:x-gb, {mongo.fileSize}]]</span></div>
						{{{ end }}}
						<hr/>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:mongo.resident-memory]]</span> <span class="text-end">[[admin/advanced/database:x-gb, {mongo.mem.resident}]]</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:mongo.virtual-memory]]</span> <span class="text-end">[[admin/advanced/database:x-gb, {mongo.mem.virtual}]]</span></div>
						<hr/>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:mongo.bytes-in]]</span> <span class="text-end">[[admin/advanced/database:x-gb, {mongo.network.bytesIn}]]</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:mongo.bytes-out]]</span> <span class="text-end">[[admin/advanced/database:x-gb, {mongo.network.bytesOut}]]</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:mongo.num-requests]]</span> <span class="text-end">{mongo.network.numRequests}</span></div>
					</div>
				</div>
			</div>
		</div>
		{{{ end }}}

		{{{ if redis }}}
		<div class="col-lg-6">
			<div class="card">
				<div class="card-header"><i class="fa fa-hdd-o"></i> [[admin/advanced/database:redis]]</div>
				<div class="card-body">
					<div class="database-info">
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.version]]</span> <span class="text-end">{redis.redis_version}</span></div>
						<hr/>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:uptime-seconds]]</span> <span class="text-end">{formattedNumber(redis.uptime_in_seconds)}</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:uptime-days]]</span> <span class="text-end">{redis.uptime_in_days}</span></div>
						<hr/>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.keys]]</span> <span class="text-end">{formattedNumber(redis.keys)}</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.expires]]</span> <span class="text-end">{formattedNumber(redis.expires)}</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.avg-ttl]]</span> <span class="text-end">{formattedNumber(redis.avg_ttl)}</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.connected-clients]]</span> <span class="text-end">{formattedNumber(redis.connected_clients)}</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.connected-slaves]]</span> <span class="text-end">{formattedNumber(redis.connected_slaves)}</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.blocked-clients]]</span> <span class="text-end">{redis.blocked_clients}</span></div>
						<hr/>

						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.used-memory]]</span> <span class="text-end">[[admin/advanced/database:x-gb, {redis.used_memory_human}]]</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.memory-frag-ratio]]</span> <span class="text-end">{redis.mem_fragmentation_ratio}</span></div>
						<hr/>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.total-connections-recieved]]</span> <span class="text-end">{formattedNumber(redis.total_connections_received)}</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.total-commands-processed]]</span> <span class="text-end">{formattedNumber(redis.total_commands_processed)}</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.iops]]</span> <span class="text-end">{formattedNumber(redis.instantaneous_ops_per_sec)}</span></div>

						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.iinput]]</span> <span class="text-end">[[admin/advanced/database:x-mb, {redis.instantaneous_input}]]</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.ioutput]]</span> <span class="text-end">[[admin/advanced/database:x-mb, {redis.instantaneous_output}]]</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.total-input]]</span> <span class="text-end">[[admin/advanced/database:x-gb, {redis.total_net_input}]]</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.total-output]]</span> <span class="text-end">[[admin/advanced/database:x-gb, {redis.total_net_output}]]</span></div>

						<hr/>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.keyspace-hits]]</span> <span class="text-end">{formattedNumber(redis.keyspace_hits)}</span></div>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:redis.keyspace-misses]]</span> <span class="text-end">{formattedNumber(redis.keyspace_misses)}</span></div>
					</div>
				</div>
			</div>
		</div>
		{{{ end }}}

		{{{ if postgres }}}
		<div class="col-lg-6">
			<div class="card">
				<div class="card-header"><i class="fa fa-hdd-o"></i> [[admin/advanced/database:postgres]]</div>
				<div class="card-body">
					<div class="database-info">
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:postgres.version]]</span> <span class="text-end">{postgres.version}</span></div>
						<hr/>
						<div class="d-flex justify-content-between"><span>[[admin/advanced/database:uptime-seconds]]</span> <span class="text-end">{formattedNumber(postgres.uptime)}</span></div>
					</div>
				</div>
			</div>
		</div>
		{{{ end }}}
	</div>

	<div class="row">
		{{{ if mongo }}}
		<div class="{{{ if redis }}}col-lg-6{{{ else }}}col-lg-12{{{ end }}}">
			<div class="card">
				<h5 class="card-header" data-bs-toggle="collapse" data-bs-target=".mongodb-raw">
					<i class="fa fa-caret-down"></i> [[admin/advanced/database:mongo.raw-info]]
				</h5>

				<div class="card-body mongodb-raw collapse">
					<div class="highlight">
						<pre>{mongo.raw}</pre>
					</div>
				</div>
			</div>
		</div>
		{{{ end }}}

		{{{ if redis }}}
		<div class="col-lg-6">
			<div class="card">
				<h5 class="card-header" data-bs-toggle="collapse" data-bs-target=".redis-raw">
					<i class="fa fa-caret-down"></i> [[admin/advanced/database:redis.raw-info]]
				</h5>

				<div class="card-body redis-raw collapse">
					<div class="highlight">
						<pre>{redis.raw}</pre>
					</div>
				</div>
			</div>
		</div>
		{{{ end }}}

		{{{ if postgres }}}
		<div class="col-lg-6">
			<div class="card">
				<h5 class="card-header" data-bs-toggle="collapse" data-bs-target=".postgresql-raw">
					<i class="fa fa-caret-down"></i> [[admin/advanced/database:postgres.raw-info]]
				</h5>

				<div class="card-body postgresql-raw collapse">
					<div class="highlight">
						<pre>{postgres.raw}</pre>
					</div>
				</div>
			</div>
		</div>
		{{{ end }}}
	</div>
</div>
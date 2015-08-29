<div class="database">
	<div class="col-sm-9">
		<!-- IF mongo -->
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-hdd-o"></i>[[admin:database.mongo]]</div>
			<div class="panel-body">
				<div class="database-info">
					<span>[[admin:database.collections]]</span> <span class="text-right formatted-number">{mongo.collections}</span><br/>
					<span>[[admin:database.objects]]</span> <span class="text-right formatted-number">{mongo.objects}</span><br/>
					<span>[[admin:database.avg_object_size]]</span> <span class="text-right">{mongo.avgObjSize} kb</span><br/>
					<hr/>
					<span>[[admin:database.data_size]]</span> <span class="text-right">{mongo.dataSize} mb</span><br/>
					<span>[[admin:database.storage_size]]</span> <span class="text-right">{mongo.storageSize} mb</span><br/>
					<span>[[admin:database.index_size]]</span> <span class="text-right">{mongo.indexSize} mb</span><br/>
					<span>[[admin:database.file_size]]</span> <span class="text-right">{mongo.fileSize} mb</span><br/>
					<hr/>
					<span>[[admin:database.resident_memory]]</span> <span class="text-right">{mongo.mem.resident} mb</span><br/>
					<span>[[admin:database.virtual_memory]]</span> <span class="text-right">{mongo.mem.virtual} mb</span><br/>
					<span>[[admin:database.mapped_memory]]</span> <span class="text-right">{mongo.mem.mapped} mb</span><br/>
				</div>
			</div>
		</div>
		<!-- ENDIF mongo -->

		<!-- IF redis -->
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-hdd-o"></i>[[admin:database.redis]]</div>
			<div class="panel-body">
				<div class="database-info">
					<span>[[admin:database.redis_version]]</span> <span class="text-right">{redis.redis_version}</span><br/>
					<hr/>
					<span>[[admin:database.uptime_in_seconds]]</span> <span class="text-right formatted-number">{redis.uptime_in_seconds}</span><br/>
					<span>[[admin:database.uptime_in_days]]</span> <span class="text-right">{redis.uptime_in_days}</span><br/>
					<hr/>
					<span>[[admin:database.connected_clients]]</span> <span class="text-right">{redis.connected_clients}</span><br/>
					<span>[[admin:database.connected_slaves]]</span> <span class="text-right">{redis.connected_slaves}</span><br/>
					<span>[[admin:database.blocked_clients]]</span> <span class="text-right">{redis.blocked_clients}</span><br/>
					<hr/>

					<span>[[admin:database.used_memory]]</span> <span class="text-right">{redis.used_memory_human}</span><br/>
					<span>[[admin:database.memory_fragmentation_ratio]]</span> <span class="text-right">{redis.mem_fragmentation_ratio}</span><br/>
					<hr/>
					<span>[[admin:database.total_connections_received]]</span> <span class="text-right formatted-number">{redis.total_connections_received}</span><br/>
					<span>[[admin:database.total_commands_processed]]</span> <span class="text-right formatted-number">{redis.total_commands_processed}</span><br/>
					<span>[[admin:database.instantaneous_ops_per_sec]]</span> <span class="text-right formatted-number">{redis.instantaneous_ops_per_sec}</span><br/>
					<hr/>
					<span>[[admin:database.keyspace_hits]]</span> <span class="text-right formatted-number">{redis.keyspace_hits}</span><br/>
					<span>[[admin:database.keyspace_misses]]</span> <span class="text-right formatted-number">{redis.keyspace_misses}</span><br/>
				</div>
			</div>
		</div>
		<!-- ENDIF redis -->

		<!-- IF mongo -->
		<div class="panel panel-default">
			<div class="panel-heading" data-toggle="collapse" data-target=".mongodb-raw">
				<h3 class="panel-title"><i class="fa fa-caret-down"></i>[[admin:database.mongodb_raw_info]]</h3>
			</div>

			<div class="panel-body mongodb-raw collapse">
				<div class="highlight">
					<pre>{mongo.raw}</pre>
				</div>
			</div>
		</div>
		<!-- ENDIF mongo -->

		<!-- IF redis -->
		<div class="panel panel-default">
			<div class="panel-heading" data-toggle="collapse" data-target=".redis-raw">
				<h3 class="panel-title"><i class="fa fa-caret-down"></i>[[admin:database.redis_raw_info]]</h3>
			</div>

			<div class="panel-body redis-raw collapse">
				<div class="highlight">
					<pre>{redis.raw}</pre>
				</div>
			</div>
		</div>
		<!-- ENDIF redis -->
	</div>
</div>

<div class="database">
	<div class="col-sm-9">
		<!-- IF mongo -->
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-hdd-o"></i> Mongo</div>
			<div class="panel-body">
				<div class="database-info">
					<span>MongoDB Version</span> <span class="text-right">{mongo.version}</span><br/>
					<hr/>
					<span>Uptime in Seconds</span> <span class="text-right formatted-number">{mongo.uptime}</span><br/>
					<span>Storage Engine</span> <span class="text-right">{mongo.storageEngine}</span><br/>
					<span>Collections</span> <span class="text-right formatted-number">{mongo.collections}</span><br/>
					<span>Objects</span> <span class="text-right formatted-number">{mongo.objects}</span><br/>
					<span>Avg. Object Size</span> <span class="text-right">{mongo.avgObjSize} b</span><br/>
					<hr/>
					<span>Data Size</span> <span class="text-right">{mongo.dataSize} mb</span><br/>
					<span>Storage Size</span> <span class="text-right">{mongo.storageSize} mb</span><br/>
					<span>Index Size</span> <span class="text-right">{mongo.indexSize} mb</span><br/>
					<!-- IF mongo.fileSize -->
					<span>File Size</span> <span class="text-right">{mongo.fileSize} mb</span><br/>
					<!-- ENDIF mongo.fileSize -->
					<hr/>
					<span>Resident Memory</span> <span class="text-right">{mongo.mem.resident} mb</span><br/>
					<span>Virtual Memory</span> <span class="text-right">{mongo.mem.virtual} mb</span><br/>
					<span>Mapped Memory</span> <span class="text-right">{mongo.mem.mapped} mb</span><br/>
				</div>
			</div>
		</div>
		<!-- ENDIF mongo -->

		<!-- IF redis -->
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-hdd-o"></i> Redis</div>
			<div class="panel-body">
				<div class="database-info">
					<span>Redis Version</span> <span class="text-right">{redis.redis_version}</span><br/>
					<hr/>
					<span>Uptime in Seconds</span> <span class="text-right formatted-number">{redis.uptime_in_seconds}</span><br/>
					<span>Uptime in Days</span> <span class="text-right">{redis.uptime_in_days}</span><br/>
					<hr/>
					<span>Connected Clients</span> <span class="text-right">{redis.connected_clients}</span><br/>
					<span>Connected Slaves</span> <span class="text-right">{redis.connected_slaves}</span><br/>
					<span>Blocked Clients</span> <span class="text-right">{redis.blocked_clients}</span><br/>
					<hr/>

					<span>Used Memory</span> <span class="text-right">{redis.used_memory_human}</span><br/>
					<span>Memory Fragmentation Ratio</span> <span class="text-right">{redis.mem_fragmentation_ratio}</span><br/>
					<hr/>
					<span>Total Connections Received</span> <span class="text-right formatted-number">{redis.total_connections_received}</span><br/>
					<span>Total Commands Processed</span> <span class="text-right formatted-number">{redis.total_commands_processed}</span><br/>
					<span>Instantaneous Ops. Per Second</span> <span class="text-right formatted-number">{redis.instantaneous_ops_per_sec}</span><br/>
					<hr/>
					<span>Keyspace Hits</span> <span class="text-right formatted-number">{redis.keyspace_hits}</span><br/>
					<span>Keyspace Misses</span> <span class="text-right formatted-number">{redis.keyspace_misses}</span><br/>
				</div>
			</div>
		</div>
		<!-- ENDIF redis -->

		<!-- IF mongo -->
		<div class="panel panel-default">
			<div class="panel-heading" data-toggle="collapse" data-target=".mongodb-raw">
				<h3 class="panel-title"><i class="fa fa-caret-down"></i> MongoDB Raw Info</h3>
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
				<h3 class="panel-title"><i class="fa fa-caret-down"></i> Redis Raw Info</h3>
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

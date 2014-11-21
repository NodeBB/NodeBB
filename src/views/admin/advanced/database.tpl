<div class="database">
	<div class="col-sm-9">
		<!-- IF redis -->
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-hdd-o"></i> Redis</div>
			<div class="panel-body">
				<div class="database-info">
					<span>Redis Version</span> <span class="text-right">{redis_version}</span><br/>
					<hr/>
					<span>Uptime in Seconds</span> <span class="text-right formatted-number">{uptime_in_seconds}</span><br/>
					<span>Uptime in Days</span> <span class="text-right">{uptime_in_days}</span><br/>
					<hr/>
					<span>Connected Clients</span> <span class="text-right">{connected_clients}</span><br/>
					<span>Connected Slaves</span> <span class="text-right">{connected_slaves}</span><br/>
					<span>Blocked Clients</span> <span class="text-right">{blocked_clients}</span><br/>
					<hr/>

					<span>Used Memory</span> <span class="text-right">{used_memory_human}</span><br/>
					<span>Memory Fragmentation Ratio</span> <span class="text-right">{mem_fragmentation_ratio}</span><br/>
					<hr/>
					<span>Total Connections Received</span> <span class="text-right formatted-number">{total_connections_received}</span><br/>
					<span>Total Commands Processed</span> <span class="text-right formatted-number">{total_commands_processed}</span><br/>
					<span>Instantaneous Ops. Per Second</span> <span class="text-right formatted-number">{instantaneous_ops_per_sec}</span><br/>
					<hr/>
					<span>Keyspace Hits</span> <span class="text-right formatted-number">{keyspace_hits}</span><br/>
					<span>Keyspace Misses</span> <span class="text-right formatted-number">{keyspace_misses}</span><br/>
				</div>
			</div>
		</div>
		<!-- ENDIF redis -->

		<!-- IF mongo -->
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-hdd-o"></i> Mongo</div>
			<div class="panel-body">
				<div class="database-info">
					<span>Collections</span> <span class="text-right formatted-number">{collections}</span><br/>
					<span>Objects</span> <span class="text-right formatted-number">{objects}</span><br/>
					<span>Avg. Object Size</span> <span class="text-right">{avgObjSize} kb</span><br/>
					<hr/>
					<span>Data Size</span> <span class="text-right">{dataSize} mb</span><br/>
					<span>Storage Size</span> <span class="text-right">{storageSize} mb</span><br/>
					<span>Index Size</span> <span class="text-right">{indexSize} mb</span><br/>
					<span>File Size</span> <span class="text-right">{fileSize} mb</span><br/>
				</div>
			</div>
		</div>
		<!-- ENDIF mongo -->

		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-hdd-o"></i> Raw Info</div>
			<div class="panel-body">
				<div class="highlight">
					<pre>{raw}</pre>
				</div>
			</div>
		</div>
	</div>
</div>

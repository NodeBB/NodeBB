

<!-- IF redis -->
<h1><i class="fa fa-hdd-o"></i> Redis</h1>
<hr />
<div id="admin-redis-info">
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
<hr />
<h3>Raw Info </h3>
<div class="highlight">
<pre>{raw}</pre>
</div>
<!-- ENDIF redis -->

<!-- IF mongo -->
<h1><i class="fa fa-hdd-o"></i> Mongo</h1>
<hr />
<div id="admin-redis-info">

	<span>Collections</span> <span class="text-right formatted-number">{collections}</span><br/>
	<span>Objects</span> <span class="text-right formatted-number">{objects}</span><br/>
	<span>Avg. Object Size</span> <span class="text-right">{avgObjSize} kb</span><br/>
	<hr/>
	<span>Data Size</span> <span class="text-right">{dataSize} mb</span><br/>
	<span>Storage Size</span> <span class="text-right">{storageSize} mb</span><br/>
	<span>Index Size</span> <span class="text-right">{indexSize} mb</span><br/>
	<span>File Size</span> <span class="text-right">{fileSize} mb</span><br/>

</div>
<hr />
<h3>Raw Info </h3>
<div class="highlight">
<pre>{raw}</pre>
</div>
<!-- ENDIF mongo -->

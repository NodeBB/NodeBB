<div class="info">
	<div class="panel panel-default">
		<div class="panel-heading">
			<h3 class="panel-title">[[admin/development/info:you-are-on, {host}, {port}]]</h3>
		</div>

		<div class="panel-body">
			<span>[[admin/development/info:nodes-responded, {nodeCount}, {timeout}]]</span>

			<table class="table table-striped">
				<thead>
					<tr>
						<td>[[admin/development/info:host]]</td>
						<td>[[admin/development/info:pid]]</td>
						<td>[[admin/development/info:nodejs]]</td>
						<td>[[admin/development/info:online]]</td>
						<td>[[admin/development/info:git]]</td>
						<td>[[admin/development/info:memory]]</td>
						<td>[[admin/development/info:load]]</td>
						<td>[[admin/development/info:uptime]]</td>
					</tr>
				</thead>
				<tbody>
				<!-- BEGIN info -->
				<tr>
					<td>{info.os.hostname}:{info.process.port}</td>
					<td>{info.process.pid}</td>
					<td>{info.process.version}</td>
					<td>
						<span title="[[admin/development/info:registered]]">{info.stats.onlineRegisteredCount}</span> /
						<span title="[[admin/development/info:guests]]">{info.stats.onlineGuestCount}</span> /
						<span title="[[admin/development/info:sockets]]">{info.stats.socketCount}</span>
					</td>
					<td>{info.git.branch}@<a href="https://github.com/NodeBB/NodeBB/commit/{info.git.hash}" target="_blank">{info.git.hash}</a></td>
					<td>{info.process.memoryUsage.humanReadable} mb</td>
					<td>{info.os.load}</td>
					<td>{info.process.uptime}</td>
				</tr>
				<!-- END info -->
				</tbody>
			</table>
			</div>
		</div>
	</div>

	<div class="panel panel-default">
		<div class="panel-heading">
			<h3 class="panel-title">[[admin/development/info:info]]</h3>
		</div>

		<div class="panel-body">
			<div class="highlight">
				<pre>{infoJSON}</pre>
			</div>
		</div>
	</div>
</div>
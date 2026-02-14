<div class="info">
	<div class="card">
		<h5 class="card-header">
			[[admin/development/info:you-are-on, {host}, {port}]] &bull; [[admin/development/info:ip, {ip}]]
		</h5>

		<div class="card-body">
			<span>[[admin/development/info:nodes-responded, {nodeCount}, {timeout}]]</span>
			<div class="table-responsive">
				<table class="table table-sm text-sm">
					<thead>
						<tr>
							<td class="fw-bold">[[admin/development/info:host]]</td>
							<td class="fw-bold text-center">[[admin/development/info:primary]]</td>
							<td class="fw-bold">[[admin/development/info:nodejs]]</td>
							<td class="fw-bold">[[admin/development/info:online]]</td>
							<td class="fw-bold">[[admin/development/info:git]]</td>
							<td class="fw-bold">[[admin/development/info:cpu-usage]]</td>
							<td class="fw-bold">[[admin/development/info:process-memory]]</td>
							<td class="fw-bold">[[admin/development/info:system-memory]]</td>
							<td class="fw-bold">[[admin/development/info:load]]</td>
							<td class="fw-bold text-end">[[admin/development/info:uptime]]</td>
						</tr>
					</thead>
					<tbody class="text-xs">
					{{{ each info }}}
					<tr>
						<td>{info.os.hostname}:{info.process.port}</td>
						<td class="text-center">
							{{{if info.nodebb.isPrimary}}}<i class="fa fa-check"></i>{{{else}}}<i class="fa fa-times"></i>{{{end}}} /
							{{{if info.nodebb.runJobs}}}<i class="fa fa-check"></i>{{{else}}}<i class="fa fa-times"></i>{{{end}}}
						</td>
						<td>{info.process.version}</td>
						<td>
							<span title="[[admin/development/info:registered]]">{info.stats.onlineRegisteredCount}</span> /
							<span title="[[admin/development/info:guests]]">{info.stats.onlineGuestCount}</span> /
							<span title="[[admin/development/info:sockets]]">{info.stats.socketCount}</span> /
							<span title="[[admin/development/info:connection-count]]">{info.stats.connectionCount}</span>
						</td>
						<td>{info.git.branch}@<a href="https://github.com/NodeBB/NodeBB/commit/{info.git.hash}" target="_blank">{info.git.hashShort}</a></td>
						<td>{info.process.cpuUsage}%</td>
						<td>
							<span title="[[admin/development/info:used-memory-process]]">{info.process.memoryUsage.humanReadable} gb</span>
						</td>
						<td>
							<span title="[[admin/development/info:used-memory-os]]">{info.os.usedmem} gb</span> /
							<span title="[[admin/development/info:total-memory-os]]">{info.os.totalmem} gb</span>
						</td>
						<td>{info.os.load}</td>
						<td class="text-end">{info.process.uptimeHumanReadable}</td>
					</tr>
					{{{ end }}}
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<div class="card">
		<h5 class="card-header">
			[[admin/development/info:info]]
		</h5>
		<div class="card-body">
			<div class="p-3 text-bg-light border border-secondary rounded">
				<pre>{infoJSON}</pre>
			</div>
		</div>
	</div>
</div>
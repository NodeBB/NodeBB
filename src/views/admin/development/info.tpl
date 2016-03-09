<div class="info">
	<div class="panel panel-default">
		<div class="panel-heading">
			<h3 class="panel-title">Info - You are on <strong>{host}:{port}</strong></h3>
		</div>

		<div class="panel-body">
			<table class="table table-striped">
				<thead>
					<tr>
						<td>host</td>
						<td>pid</td>
						<td>nodejs</td>
						<td>online</td>
						<td>git</td>
						<td>load</td>
						<td>uptime</td>
					</tr>
				</thead>
				<tbody>
				<!-- BEGIN info -->
				<tr>
					<td>{info.os.hostname}:{info.process.port}</td>
					<td>{info.process.pid}</td>
					<td>{info.process.version}</td>
					<td><span title="Registered">{info.stats.onlineRegisteredCount}</span> / <span title="Guest">{info.stats.onlineGuestCount}</span> / <span title="Sockets">{info.stats.socketCount}</span></td>
					<td>{info.git.branch}@<a href="https://github.com/NodeBB/NodeBB/commit/{info.git.hash}" target="_blank">{info.git.hash}</a></td>
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
			<h3 class="panel-title">Info</h3>
		</div>

		<div class="panel-body">
			<div class="highlight">
				<pre>{infoJSON}</pre>
			</div>
		</div>
	</div>
</div>
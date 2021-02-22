<div class="row">
	<div class="table-responsive">
		<table class="table table-striped">
			<thead>
				<tr>
					<th></th>
					<th class="text-right">[[admin/dashboard:stats.yesterday]]</th>
					<th class="text-right">[[admin/dashboard:stats.today]]</th>
					<th></th>
					<th class="text-right">[[admin/dashboard:stats.last-week]]</th>
					<th class="text-right">[[admin/dashboard:stats.this-week]]</th>
					<th></th>
					<th class="text-right">[[admin/dashboard:stats.last-month]]</th>
					<th class="text-right">[[admin/dashboard:stats.this-month]]</th>
					<th></th>
					<th class="text-right">[[admin/dashboard:stats.all]]</th>
				</tr>
			</thead>
			<tbody>
				<!-- BEGIN stats -->
				<tr>
					<td>
						<strong>
							{{{ if ../href }}}
								<a href="{../href}">{../name}</a>
							{{{ else }}}
								{../name}
							{{{ end }}}
						</strong>
					</td>
					<td class="text-right formatted-number">{stats.yesterday}</td>
					<td class="text-right formatted-number">{stats.today}</td>
					<td class="{stats.dayTextClass}"><small>{stats.dayIncrease}%</small></td>

					<td class="text-right formatted-number">{stats.lastweek}</td>
					<td class="text-right formatted-number">{stats.thisweek}</td>
					<td class="{stats.weekTextClass}"><small>{stats.weekIncrease}%</small></td>

					<td class="text-right formatted-number">{stats.lastmonth}</td>
					<td class="text-right formatted-number">{stats.thismonth}</td>
					<td class="{stats.monthTextClass}"><small>{stats.monthIncrease}%</small></td>

					<td class="text-right formatted-number">{stats.alltime}</td>
				</tr>
				<!-- END stats -->
			</tbody>
		</table>
	</div>
</div>
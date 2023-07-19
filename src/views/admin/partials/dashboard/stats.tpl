<div class="table-responsive mb-3">
	<table class="table text-sm">
		<thead>
			<tr>
				<th></th>
				<th class="text-end">[[admin/dashboard:stats.yesterday]]</th>
				<th class="text-end">[[admin/dashboard:stats.today]]</th>
				<th></th>
				<th class="text-end">[[admin/dashboard:stats.last-week]]</th>
				<th class="text-end">[[admin/dashboard:stats.this-week]]</th>
				<th></th>
				<th class="text-end">[[admin/dashboard:stats.last-month]]</th>
				<th class="text-end">[[admin/dashboard:stats.this-month]]</th>
				<th></th>
				<th class="text-end">[[admin/dashboard:stats.all]]</th>
			</tr>
		</thead>
		<tbody>
			{{{ each stats }}}
			<tr>
				<td>
					<strong>
						{{{ if ./href }}}
							<a href="{./href}">{./name}</a>
						{{{ else }}}
							{./name}
						{{{ end }}}
					</strong>
				</td>
				<td class="text-end">{formattedNumber(./yesterday)}</td>
				<td class="text-end">{formattedNumber(./today)}</td>
				<td class="{./dayTextClass}"><small>{./dayIncrease}%</small></td>

				<td class="text-end">{formattedNumber(./lastweek)}</td>
				<td class="text-end">{formattedNumber(./thisweek)}</td>
				<td class="{./weekTextClass}"><small>{./weekIncrease}%</small></td>

				<td class="text-end">{formattedNumber(./lastmonth)}</td>
				<td class="text-end">{formattedNumber(./thismonth)}</td>
				<td class="{./monthTextClass}"><small>{./monthIncrease}%</small></td>

				<td class="text-end">{formattedNumber(./alltime)}</td>
			</tr>
			{{{ end }}}
		</tbody>
	</table>
</div>
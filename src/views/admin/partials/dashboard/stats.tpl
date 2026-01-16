<div class="table-responsive mb-3">
	<table class="table">
		<thead class="text-xs">
			<tr>
				<th></th>
				<th class="text-end text-nowrap">[[admin/dashboard:stats.yesterday]]</th>
				<th class="text-end text-nowrap">[[admin/dashboard:stats.today]]</th>
				<th></th>
				<th class="text-end text-nowrap">[[admin/dashboard:stats.last-week]]</th>
				<th class="text-end text-nowrap">[[admin/dashboard:stats.this-week]]</th>
				<th></th>
				<th class="text-end text-nowrap">[[admin/dashboard:stats.last-month]]</th>
				<th class="text-end text-nowrap">[[admin/dashboard:stats.this-month]]</th>
				<th></th>
				{{{ if !hideAllTime}}}
				<th class="text-end">[[admin/dashboard:stats.all]]</th>
				{{{ end }}}
			</tr>
		</thead>
		<tbody class="text-sm">
			{{{ each stats }}}
			<tr>
				<td class="fw-bold text-nowrap">

						{{{ if ./href }}}
							<a href="{./href}">{./name}</a>
						{{{ else }}}
							{./name}
						{{{ end }}}

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
				{{{ if !hideAllTime}}}
				<td class="text-end">{formattedNumber(./alltime)}</td>
				{{{ end }}}
			</tr>
			{{{ end }}}
		</tbody>
	</table>
</div>
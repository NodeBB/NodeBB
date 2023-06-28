<div class="row dashboard px-lg-4">
	<div class="col-12">

		<form class="d-flex flex-wrap gap-3 align-sm-items-center mb-3" method="GET">
			<div class="d-flex align-items-center gap-2">
				<label class="form-label mb-0" for="start">[[admin/dashboard:start]]</label>
				<input type="date" class="form-control form-control-sm w-auto" id="start" name="start" value="{startDate}">
			</div>
			<div class="d-flex align-items-center gap-2">
				<label class="form-label mb-0" for="end">[[admin/dashboard:end]]</label>
				<input type="date" class="form-control form-control-sm w-auto" id="end" name="end" value="{endDate}">
			</div>
			<div class="">
				<button onclick="$('form').submit();return false;"class="btn btn-primary btn-sm" type="submit">[[admin/dashboard:filter]]</button>
			</div>
		</form>


		<table class="table table-sm text-sm search-list">
			<thead>
				<th class="text-end">Count</th>
				<th>Term</th>
			</thead>
			<tbody>
				{{{ if !searches.length}}}
				<tr>
					<td colspan=4" class="text-center"><em>[[admin/dashboard:details.no-searches]]</em></td>
				</tr>
				{{{ end }}}
				{{{ each searches }}}
				<tr>
					<td class="text-end" style="width: 1px;">{searches.score}</td>
					<td>{searches.value}</a></td>
				</tr>
				{{{ end }}}
			</tbody>
		</table>
	</div>
</div>
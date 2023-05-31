<div class="row dashboard px-lg-4">
	<div class="col-12">
		<div class="d-flex justify-content-end gap-2 mb-3">
			<form class="row row-cols-lg-auto g-3 align-items-center" method="GET">
				<div class="col-12 d-flex align-items-center gap-2">
					<label class="form-label mb-0" for="start">[[admin/dashboard:start]]</label>
					<input type="date" class="form-control form-control-sm" id="start" name="start" value="{startDate}">
				</div>
				<div class="col-12 d-flex align-items-center gap-2">
					<label class="form-label mb-0" for="end">[[admin/dashboard:end]]</label>
					<input type="date" class="form-control form-control-sm" id="end" name="end" value="{endDate}">
				</div>
				<div class="col-12">
					<button onclick="$('form').submit();return false;"class="btn btn-primary btn-sm" type="submit">Filter</button>
				</div>
			</form>
		</div>

		<table class="table table-sm search-list">
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
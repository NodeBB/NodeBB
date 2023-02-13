<div class="row dashboard">
	<div class="col-12">
		<div class="d-flex gap-2 mb-3">
			<a class="btn btn-primary me-auto align-items-center" href="{config.relative_path}/admin/dashboard">
				<i class="fa fa-chevron-left"></i>
				[[admin/dashboard:back-to-dashboard]]
			</a>
			<form class="row row-cols-lg-auto g-3 align-items-center" method="GET">
				<div class="col-12 d-flex align-items-center gap-2">
					<label class="form-label mb-0" for="start">[[admin/dashboard:start]]</label>
					<input type="date" class="form-control" id="start" name="start" value="{startDate}">
				</div>
				<div class="col-12 d-flex align-items-center gap-2">
					<label class="form-label mb-0" for="end">[[admin/dashboard:end]]</label>
					<input type="date" class="form-control" id="end" name="end" value="{endDate}">
				</div>
				<div class="col-12">
					<button onclick="$('form').submit();return false;"class="btn btn-primary" type="submit">Filter</button>
				</div>
			</form>
		</div>

		<table class="table table-striped search-list">
			<tbody>
				{{{ if !searches.length}}}
				<tr>
					<td colspan=4" class="text-center"><em>[[admin/dashboard:details.no-searches]]</em></td>
				</tr>
				{{{ end }}}
				{{{ each searches }}}
				<tr>
					<td>{searches.value}</a></td>
					<td class="text-end">{searches.score}</td>
				</tr>
				{{{ end }}}
			</tbody>
		</table>
	</div>
</div>
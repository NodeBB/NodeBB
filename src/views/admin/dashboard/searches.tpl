<div class="row dashboard px-lg-4">
	<div class="col-12 col-md-8 mx-auto">
		<div class="d-flex flex-wrap gap-3 justify-content-between align-items-center mb-3">
			<form class="d-flex flex-wrap gap-3 align-sm-items-center" method="GET">
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
			<button id="clear-search-history" class="btn btn-sm btn-light text-nowrap"><i class="fa fa-trash text-danger"></i> [[admin/dashboard:clear-search-history]]</button>
		</div>

		<table class="table table-sm text-sm search-list w-100">
			<thead>
				<th class="text-end">[[admin/dashboard:search-count]]</th>
				<th>[[admin/dashboard:search-term]]</th>
			</thead>
			<tbody>
				{{{ if !searches.length}}}
				<tr>
					<td colspan=4" class="text-center"><em>[[admin/dashboard:details.no-searches]]</em></td>
				</tr>
				{{{ end }}}
				{{{ each searches }}}
				<tr>
					<td class="w-0 text-end text-nowrap text-tabular">{formattedNumber(searches.score)}</td>
					<td class="w-100 text-truncate" style="max-width:1px;">{searches.value}</td>
				</tr>
				{{{ end }}}
			</tbody>
		</table>
		<!-- IMPORT admin/partials/paginator.tpl -->
	</div>
</div>
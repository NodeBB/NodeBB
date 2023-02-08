<div class="row dashboard">
	<div class="col-xs-12">
		<div class="clearfix">
			<a class="btn btn-link" href="{config.relative_path}/admin/dashboard">
				<i class="fa fa-chevron-left"></i>
				[[admin/dashboard:back-to-dashboard]]
			</a>
			<form class="form-inline pull-right" method="GET">
				<div class="form-group">
					<label>[[admin/dashboard:start]]</label>
					<input type="date" class="form-control" name="start" value="{startDate}">
				</div>
				<div class="form-group">
					<label>[[admin/dashboard:end]]</label>
					<input type="date" class="form-control" name="end" value="{endDate}">
				</div>
				<button onclick="$('form').submit();return false;"class="btn btn-primary" type="submit">Filter</button>
			</form>
		</div>
		<hr/>

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
					<td class="text-right">{searches.score}</td>
				</tr>
				{{{ end }}}
			</tbody>
		</table>
	</div>
</div>
<div class="row dashboard">
	<div class="col-xs-12">
		<a class="btn btn-link" href="{config.relative_path}/admin/dashboard">
			<i class="fa fa-chevron-left"></i>
			[[admin/dashboard:back-to-dashboard]]
		</a>


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
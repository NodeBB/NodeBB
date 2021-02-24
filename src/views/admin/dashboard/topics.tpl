<div class="row dashboard">
	<div class="col-xs-12">
		<a class="btn btn-link" href="{config.relative_path}/admin/dashboard">
			<i class="fa fa-chevron-left"></i>
			[[admin/dashboard:back-to-dashboard]]
		</a>

		<!-- IMPORT admin/partials/dashboard/graph.tpl -->
		<!-- IMPORT admin/partials/dashboard/stats.tpl -->

		<table class="table table-striped topics-list">
			<tbody>
				{{{ if !topics.length}}}
				<tr>
					<td colspan=4" class="text-center"><em>[[admin/dashboard:details.no-topics]]</em></td>
				</tr>
				{{{ end }}}
				{{{ each topics }}}
				<tr>
					<td><a href="{config.relative_path}/topics/{../slug}">{../title}</a></td>
					<td>[[topic:posted_by, {../user.username}]]</td>
					<td><span class="timeago" data-title="{../timestampISO}"></span></td>
				</tr>
				{{{ end }}}
			</tbody>
		</table>
	</div>
</div>
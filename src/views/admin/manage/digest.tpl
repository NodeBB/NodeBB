<p class="lead">[[admin/manage/digest:lead]]</p>
<p>[[admin/manage/digest:disclaimer]]</p>
<p>[[admin/manage/digest:disclaimer-continued]]</p>

<hr />

<table class="table table-striped">
	<thead>
		<th>[[admin/manage/digest:user]]</th>
		<th>[[admin/manage/digest:subscription]]</th>
		<th>[[admin/manage/digest:last-delivery]]</th>
	</thead>
	<tbody>
		<!-- BEGIN delivery -->
		<tr>
			<td><a href="{config.relative_path}/uid/{../uid}">{buildAvatar(delivery, "sm", true)} {../username}</a></td>
			<td>{{{if ../setting}}}{../setting}{{{else}}}<em>[[admin/manage/digest:default]]</em>{{{end}}}</td>
			<td>{../lastDelivery}</td>
		</tr>
		<!-- END delivery -->
		<!-- IF !delivery.length -->
		<tr>
			<td colspan="2">
				<div class="alert alert-success">
					[[admin/manage/digest:no-delivery-data]]
				</div>
			</td>
		</tr>
		<!-- ENDIF !delivery.length -->
	</tbody>
	<tfoot>
		<tr>
			<td colspan="3">
				<em>[[admin/manage/digest:default-help, {default}]]</em>
			</td>
		</tr>
	</tfoot>
</table>

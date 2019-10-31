<p class="lead">[[admin/manage/digest:lead]]</p>
<p>[[admin/manage/digest:disclaimer]]</p>
<p>[[admin/manage/digest:disclaimer-continued]]</p>

<hr />

<table class="table table-striped">
	<thead>
		<th>[[admin/manage/digest:user]]</th>
		<th>[[admin/manage/digest:subscription]]</th>
		<th>[[admin/manage/digest:last-delivery]]</th>
		<th></th>
	</thead>
	<tbody>
		<!-- BEGIN delivery -->
		<tr>
			<td><a href="{config.relative_path}/uid/{../uid}">{buildAvatar(delivery, "sm", true)} {../username}</a></td>
			<td>{{{if ../setting}}}{../setting}{{{else}}}<em>[[admin/manage/digest:default]]</em>{{{end}}}</td>
			<td>{../lastDelivery}</td>
			<td><button class="btn btn-xs btn-default" data-action="resend" data-uid="{../uid}">[[admin/manage/digest:resend]]</button></td>
		</tr>
		<!-- END delivery -->
		<!-- IF !delivery.length -->
		<tr>
			<td colspan="4">
				<div class="alert alert-success">
					[[admin/manage/digest:no-delivery-data]]
				</div>
			</td>
		</tr>
		<!-- ENDIF !delivery.length -->
	</tbody>
	<tfoot>
		<tr>
			<td colspan="4"><!-- IMPORT partials/paginator.tpl --></td>
		</tr>
		<tr>
			<td colspan="4">
				<em>[[admin/manage/digest:default-help, {default}]]</em>
			</td>
		</tr>
		<tr>
			<td colspan="4">
				[[admin/manage/digest:manual-run]]
				<button class="btn btn-xs btn-default" data-action="resend-day">[[admin/settings/user:digest-freq.daily]]</button>
				<button class="btn btn-xs btn-default" data-action="resend-week">[[admin/settings/user:digest-freq.weekly]]</button>
				<button class="btn btn-xs btn-default" data-action="resend-month">[[admin/settings/user:digest-freq.monthly]]</button>
			</td>
		</tr>
	</tfoot>
</table>

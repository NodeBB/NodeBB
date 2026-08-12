<div class="px-lg-4 digest">
	<p class="lead">{{tx("admin/manage/digest:lead")}}</p>
	<p>{{tx("admin/manage/digest:disclaimer")}}</p>
	<p>{{tx("admin/manage/digest:disclaimer-continued")}}</p>

	<hr />


	<div class="mb-3">
		<div class="mb-2"><em>{{tx("admin/manage/digest:default-help", default)}}</em></div>
		<div class="d-flex gap-1 align-items-center">
			<div>{{tx("admin/manage/digest:manual-run")}}</div>
			<button class="btn btn-sm btn-outline-secondary" data-action="resend-day">{{tx("admin/settings/user:digest-freq.daily")}}</button>
			<button class="btn btn-sm btn-outline-secondary" data-action="resend-week">{{tx("admin/settings/user:digest-freq.weekly")}}</button>
			<button class="btn btn-sm btn-outline-secondary" data-action="resend-biweek">{{tx("admin/settings/user:digest-freq.biweekly")}}</button>
			<button class="btn btn-sm btn-outline-secondary" data-action="resend-month">{{tx("admin/settings/user:digest-freq.monthly")}}</button>
		</div>
	</div>

	<div class="table-responsive">
		<table class="table">
			<thead>
				<th>{{tx("admin/manage/digest:user")}}</th>
				<th>{{tx("admin/manage/digest:subscription")}}</th>
				<th>{{tx("admin/manage/digest:last-delivery")}}</th>
				<th></th>
			</thead>
			<tbody>
				{{{ each delivery }}}
				<tr>
					<td>{{buildAvatar(delivery, "24px", true)}} <a href="{config.relative_path}/uid/{./uid}">{./username}</a></td>
					<td>{{{if ./setting}}}{./setting}{{{else}}}<em>{{tx("admin/manage/digest:default")}}</em>{{{end}}}</td>
					<td>{{tx(./lastDelivery)}}</td>
					<td><button class="btn btn-sm btn-outline-secondary" data-action="resend" data-uid="{./uid}">{{tx("admin/manage/digest:resend")}}</button></td>
				</tr>
				{{{ end }}}
				{{{ if !delivery.length }}}
				<tr>
					<td colspan="4">
						<div class="alert alert-success">
							{{tx("admin/manage/digest:no-delivery-data")}}
						</div>
					</td>
				</tr>
				{{{ end }}}
			</tbody>
			<tfoot>
				<tr>
					<td colspan="4"><!-- IMPORT admin/partials/paginator.tpl --></td>
				</tr>
			</tfoot>
		</table>
	</div>
</div>
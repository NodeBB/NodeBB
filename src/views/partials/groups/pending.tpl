{{{ if group.pending.length }}}
<div class="d-flex justify-content-end gap-2 mb-3">
	<button class="btn btn-danger btn-sm" data-action="rejectAll">[[groups:pending.reject-all]]</button>
	<button class="btn btn-success btn-sm" data-action="acceptAll">[[groups:pending.accept-all]]</button>

</div>
{{{ end }}}

<div style="max-height: 500px;overflow: auto;">
	<div component="groups/pending/alert" class="alert alert-info {{{ if group.pending.length }}}hidden{{{ end }}}">[[groups:pending.none]]</div>
	<table component="groups/pending" class="table table-hover">
		<tbody>
			{{{ each group.pending }}}
			<tr data-uid="{group.pending.uid}" class="align-middle">
				<td class="member-name p-2 d-flex align-items-center justify-content-between">
					<div class="d-flex gap-2">
						<a class="text-decoration-none" href="{config.relative_path}/user/{group.pending.userslug}">{{buildAvatar(group.pending, "24px", true)}}</a>
						<a href="{config.relative_path}/user/{group.pending.userslug}">{group.pending.username}</a>
					</div>
					<div class="d-flex gap-2">
						<button class="btn btn-danger btn-sm" data-action="reject">[[groups:pending.reject]]</a></li>
						<button class="btn btn-success btn-sm" data-action="accept">[[groups:pending.accept]]</a></li>
					</div>
				</td>
			</tr>
			{{{ end }}}
		</tbody>
	</table>
</div>

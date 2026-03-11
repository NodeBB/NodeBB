
<div class="d-flex flex-column gap-2 px-lg-4">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/advanced/jobs:jobs]]</h4>
		</div>
	</div>

	<div>
		<div class="table-responsive">
			<table id="jobs-table" class="table">
				<thead>
					<tr class="text-sm">
						<th>[[admin/advanced/jobs:job-name]]</th>
						<th>[[admin/advanced/jobs:schedule]]</th>
						<th>[[admin/advanced/jobs:next-run]]</th>
						<th class="text-end">[[admin/advanced/jobs:last-duration]]</th>
						<th class="text-center">[[admin/advanced/jobs:running]]</th>
						<th class="text-center">[[admin/advanced/jobs:active]]</th>
					</tr>
				</thead>
				<tbody class="text-xs text-tabular">
				{{{ each jobs }}}
				<tr class="align-middle">
					<td>{./name}</td>
					<td>{./cronTimeHuman} <span class="text-secondary">({./cronTime})</span></td>
					<td><span class="timeago" title="{./nextRunISO}"></span></td>
					<td class="text-end">{./durationReadable}</td>
					<td class="text-center">{{{ if ./running }}}<i class="fa-solid fa-circle text-success"></i>{{{ else }}}<i class="fa-solid fa-circle text-danger"></i>{{{ end }}}</td>
					<td class="text-center text-sm">{{{ if ./active }}}<i class="fa-solid fa-check text-success"></i>{{{ else }}}<i class="fa-solid fa-times"></i>{{{ end }}}</td>
				</tr>
				{{{ end }}}
				</tbody>
			</table>
		</div>
	</div>
</div>


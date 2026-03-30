<div class="acp-page-container px-lg-4">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/manage/uploads:manage-uploads]]</h4>
		</div>
		<div class="d-flex gap-1">

			<button id="new-folder" class="btn btn-light btn-sm"><i class="fa fa-folder"></i> [[admin/manage/uploads:new-folder]]</button>

			<button id="upload" class="btn btn-primary btn-sm"><i class="fa fa-upload"></i> [[global:upload]]</button>
		</div>
	</div>

	<div class="">
	<!-- IMPORT admin/partials/breadcrumbs.tpl -->
	</div>

	<div class="table-responsive">
		<table class="table">
			<thead>
				<tr>
					<th>[[admin/manage/uploads:filename]]</th>
					{{{ if showPids }}}<th class="text-end">[[admin/manage/uploads:usage]]</th>{{{ end }}}
					<th class="text-end">[[admin/manage/uploads:size/filecount]]</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{{{ each files }}}
				<tr data-path="{files.path}">
					{{{ if files.isDirectory }}}
					<td class="align-middle" role="button">
						<i class="fa fa-fw fa-folder-o"></i> <a href="{config.relative_path}/admin/manage/uploads?dir={files.path}">{files.name}</a>
					</td>
					{{{ end }}}

					{{{ if files.isFile }}}
					<td class="align-middle">
						<i class="fa fa-fw fa-file-text-o"></i> <a class="text-break" href="{config.relative_path}{files.url}" target="_blank">{files.name}</a>
					</td>
					{{{ end }}}

					{{{ if showPids }}}
					<td class="text-end align-middle">
						{{{ each ./inPids }}}
						<a target="_blank" href="{config.relative_path}/post/{@value}"><span class="label label-default">{@value}</span></a>
						{{{ end }}}
						{{{ if !./inPids.length }}}
						<span class="label label-danger">[[admin/manage/uploads:orphaned]]</span>
						{{{ end }}}
					</td>
					{{{ end }}}

					<td class="text-end align-middle">{{{ if files.isFile }}}{files.sizeHumanReadable}{{{ else }}}[[admin/manage/uploads:filecount, {files.fileCount}]]{{{ end }}}</td>

					<td role="button" class="align-middle text-end">
						<button class="delete btn btn-sm btn-light {{{ if !files.isFile }}} hidden{{{ end }}}">
							<i class="fa fa-fw fa-trash-o text-danger"></i>
						</button>
					</td>
				</tr>
				{{{ end }}}
			</tbody>
		</table>
	</div>

	<!-- IMPORT admin/partials/paginator.tpl -->
</div>
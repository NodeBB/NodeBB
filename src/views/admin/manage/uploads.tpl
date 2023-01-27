<!-- IMPORT partials/breadcrumbs.tpl -->
<div class="clearfix">
	<div class="float-end">
		<div class="btn-group">
			<button id="new-folder" class="btn btn-primary"><i class="fa fa-folder"></i> [[admin/manage/uploads:new-folder]]</button>
		</div>
		<div class="btn-group">
			<button id="upload" class="btn btn-success"><i class="fa fa-upload"></i> [[global:upload]]</button>
		</div>
	</div>
</div>

<div class="table-responsive">
	<table class="table table-striped users-table">
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
				<td class="col-md-6" role="button">
					<i class="fa fa-fw fa-folder-o"></i> <a href="{config.relative_path}/admin/manage/uploads?dir={files.path}">{files.name}</a>
				</td>
				{{{ end }}}

				{{{ if files.isFile }}}
				<td class="col-md-6">
					<i class="fa fa-fw fa-file-text-o"></i> <a href="{config.relative_path}{files.url}" target="_blank">{files.name}</a>
				</td>
				{{{ end }}}

				{{{ if showPids }}}
				<td class="col-md-3 text-end">
					{{{ each ./inPids }}}
					<a target="_blank" href="{config.relative_path}/post/{@value}"><span class="label label-default">{@value}</span></a>
					{{{ end }}}
					{{{ if !./inPids.length }}}
					<span class="label label-danger">[[admin/manage/uploads:orphaned]]</span>
					{{{ end }}}
				</td>
				{{{ end }}}

				<td class="col-md-2 text-end">{{{ if files.isFile }}}{files.sizeHumanReadable}{{{ else }}}[[admin/manage/uploads:filecount, {files.fileCount}]]{{{ end }}}</td>

				<td role="button" class="col-md-1 text-end"><i class="delete fa fa-fw fa-trash-o {{{ if !files.isFile }}} hidden{{{ end }}}"></i></td>
			</tr>
			{{{ end }}}
		</tbody>
	</table>
</div>

<!-- IMPORT partials/paginator.tpl -->
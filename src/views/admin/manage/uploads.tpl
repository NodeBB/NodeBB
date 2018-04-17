<!-- IMPORT partials/breadcrumbs.tpl -->
<div class="clearfix">
	<button id="upload" class="btn-success pull-right"><i class="fa fa-upload"></i> [[global:upload]]</button>
</div>

<div class="table-responsive">
	<table class="table table-striped users-table">
		<thead>
			<tr>
				<th>[[admin/manage/uploads:filename]]</th>
				<!-- IF showPids --><th class="text-right">[[admin/manage/uploads:usage]]</th><!-- END -->
				<th class="text-right">[[admin/manage/uploads:size/filecount]]</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			<!-- BEGIN files -->
			<tr data-path="{files.path}">
				<!-- IF files.isDirectory -->
				<td class="col-md-6" role="button">
					<i class="fa fa-fw fa-folder-o"></i> <a href="{config.relative_path}/admin/manage/uploads?dir={files.path}">{files.name}</a>
				</td>
				<!-- ENDIF files.isDirectory -->

				<!-- IF files.isFile -->
				<td class="col-md-6">
					<i class="fa fa-fw fa-file-text-o"></i> <a href="{config.relative_path}{files.url}" target="_blank">{files.name}</a>
				</td>
				<!-- ENDIF files.isFile -->

				<!-- IF showPids -->
				<td class="col-md-3 text-right">
					<!-- BEGIN ../inPids -->
					<a target="_blank" href="{config.relative_path}/post/@value"><span class="label label-default">@value</span></a>
					<!-- END -->
					<!-- IF !../inPids.length -->
					<span class="label label-danger">[[admin/manage/uploads:orphaned]]</span>
					<!-- END -->
				</td>
				<!-- END -->

				<td class="col-md-2 text-right"><!-- IF files.isFile -->{files.sizeHumanReadable}<!-- ELSE -->[[admin/manage/uploads:filecount, {files.fileCount}]]<!-- ENDIF files.isFile --></td>

				<td role="button" class="col-md-1 text-right"><i class="delete fa fa-fw fa-trash-o <!-- IF !files.isFile --> hidden<!-- ENDIF !files.isFile -->"></i></td>
			</tr>
			<!-- END files -->
		</tbody>
	</table>
</div>

<!-- IMPORT partials/paginator.tpl -->
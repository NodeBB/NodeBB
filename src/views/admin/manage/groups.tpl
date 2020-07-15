<div class="row groups">
	<div class="col-xs-12">
		<div>
			<input id="group-search" type="text" class="form-control" placeholder="[[admin/manage/groups:search-placeholder]]" />
		</div>

		<table class="table table-striped groups-list">
			<thead>
				<tr>
					<th>[[admin/manage/groups:name]]</th>
					<th>[[admin/manage/groups:badge]]</th>
					<th>[[admin/manage/groups:properties]]</th>
					<th class="hidden-xs">[[admin/manage/groups:description]]</th>
					<th class="hidden-xs text-right">[[admin/manage/groups:member-count]]</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				<!-- BEGIN groups -->
				<tr data-groupname="{groups.displayName}">
					<td>
						<a href="{config.relative_path}/admin/manage/groups/{groups.nameEncoded}">{groups.displayName}</a>
					</td>
					<td>
						<span class="label label-default" style="color:{groups.textColor}; background-color: {groups.labelColor};"><!-- IF groups.icon --><i class="fa {groups.icon}"></i> <!-- ENDIF groups.icon -->{groups.userTitle}</span>
					</td>
					<td>
						<!-- IF groups.system -->
						<span class="label label-danger">[[admin/manage/groups:system]]</span>
						<!-- ENDIF groups.system -->
						<!-- IF groups.private -->
						<span class="label label-primary">[[admin/manage/groups:private]]</span>
						<!-- ENDIF groups.private -->
						<!-- IF groups.hidden -->
						<span class="label label-default">[[admin/manage/groups:hidden]]</span>
						<!-- ENDIF groups.hidden -->
					</td>
					<td class="hidden-xs">
						<p class="description">{groups.description}</p>
					</td>
					<td class="hidden-xs text-right">
						{groups.memberCount}
					</td>
					<td>
						<div class="btn-group">
							<button class="btn btn-default btn-xs dropdown-toggle" data-toggle="dropdown" type="button"><i class="fa fa-fw fa-ellipsis-h"></i></button>
							<ul class="dropdown-menu dropdown-menu-right">
								<li><a href="{config.relative_path}/admin/manage/groups/{groups.nameEncoded}"><i class="fa fa-fw fa-edit"></i> [[admin/manage/groups:edit]]</a></li>
								<li><a href="{config.relative_path}/api/admin/groups/{groups.nameEncoded}/csv"><i class="fa fa-fw fa-file-text"></i> [[admin/manage/groups:download-csv]]</a></li>
								<!-- IF !groups.system -->
								<li data-action="delete"><a href="#"><i class="fa fa-fw fa-times"></i> [[admin/manage/groups:delete]]</a></li>
								<!-- ENDIF !groups.system -->
							</ul>
						</div>
					</td>
				</tr>
				<!-- END groups -->
			</tbody>
			<tfoot>
				<tr>
					<td colspan="6"><br /><br /></td>
				</tr>
			</tfoot>
		</table>

		<!-- IMPORT partials/paginator.tpl -->
	</div>

	<div class="modal fade" id="create-modal">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h4 class="modal-title">[[admin/manage/groups:create]]</h4>
				</div>
				<div class="modal-body">
					<div class="alert alert-danger hide" id="create-modal-error"></div>
					<form>
						<div class="form-group">
							<label for="create-group-name">[[admin/manage/groups:name]]</label>
							<input type="text" class="form-control" id="create-group-name" placeholder="[[admin/manage/groups:name]]" />
						</div>
						<div class="form-group">
							<label for="create-group-desc">[[admin/manage/groups:description]]</label>
							<input type="text" class="form-control" id="create-group-desc" placeholder="[[admin/manage/groups:description-placeholder]]" />
						</div>
						<div class="form-group">
							<label>
								<input id="create-group-private" name="private" type="checkbox" checked>
								<strong>[[admin/manage/groups:private]]</strong>
							</label>
						</div>
						<div class="form-group">
							<label>
								<input id="create-group-hidden" name="hidden" type="checkbox">
								<strong>[[admin/manage/groups:hidden]]</strong>
							</label>
						</div>

					</form>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-default" data-dismiss="modal">
						[[global:close]]
					</button>
					<button type="button" class="btn btn-primary" id="create-modal-go">
						[[admin/manage/groups:create-button]]
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<button id="create" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
    <i class="material-icons">add</i>
</button>

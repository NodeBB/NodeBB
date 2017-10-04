<div class="row groups">
	<div class="col-xs-12">
		<div>
			<input id="group-search" type="text" class="form-control" placeholder="[[admin/manage/groups:search-placeholder]]" />
		</div>

		<table class="table table-striped groups-list">
			<thead>
				<tr>
					<th>[[admin/manage/groups:name]]</th>
					<th class="hidden-xs">[[admin/manage/groups:description]]</th>
					<th class="hidden-xs">[[admin/manage/groups:member-count]]</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				<!-- BEGIN groups -->
				<tr data-groupname="{groups.displayName}">
					<td>
						{groups.displayName}
						<!-- IF groups.system -->
						<span class="badge">[[admin/manage/groups:system]]</span>
						<!-- ENDIF groups.system -->
					</td>
					<td class="hidden-xs">
						<p class="description">{groups.description}</p>
					</td>
					<td class="hidden-xs text-right">
						{groups.memberCount}
					</td>
					<td>
						<div class="btn-group ">
							<a href="{config.relative_path}/admin/manage/groups/{groups.nameEncoded}" class="btn btn-default btn-xs">
								<i class="fa fa-edit"></i> [[admin/manage/groups:edit]]
							</a>
							<!-- IF !groups.system -->
							<button class="btn btn-danger btn-xs" data-action="delete"><i class="fa fa-times"></i></button>
							<!-- ENDIF !groups.system -->
						</div>
					</td>
				</tr>
				<!-- END groups -->
			</tbody>
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

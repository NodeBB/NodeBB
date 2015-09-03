<div class="groups">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-group"></i> [[admin:groups.groups_list]]</div>
			<div class="panel-body">

				<input id="group-search" type="text" class="form-control" placeholder="[[admin:groups.search]]" /><br/>

				<table class="table table-striped groups-list">
					<tr>
						<th>[[admin:groups.group_name]]</th>
						<th>[[admin:groups.group_description]]</th>
					</tr>
					<!-- BEGIN groups -->
					<tr data-groupname="{groups.displayName}">
						<td>
							{groups.displayName}
							<!-- IF groups.system -->
							<span class="badge">[[admin:groups.system_group]]</span>
							<!-- ENDIF groups.system -->
						</td>
						<td>
							<div class="btn-group pull-right">
								<a href="{config.relative_path}/admin/manage/groups/{groups.nameEncoded}" class="btn btn-default btn-xs"><i class="fa fa-edit"></i> [[admin:groups.edit]]</a>
								<!-- IF !groups.system -->
								<button class="btn btn-danger btn-xs" data-action="delete"><i class="fa fa-times"></i></button>
								<!-- ENDIF !groups.system -->
							</div>
							<p class="description">{groups.description}</p>
						</td>
					</tr>
					<!-- END groups -->
				</table>
				<!-- IMPORT partials/paginator.tpl -->
			</div>
		</div>
	</div>

	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin:groups.groups_control_panel]]</div>
			<div class="panel-body">
				<div>
					<button class="btn btn-primary" id="create">[[admin:groups.new_group]]</button>
				</div>
			</div>
		</div>
	</div>

	<div class="modal fade" id="create-modal">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h4 class="modal-title">[[admin:groups.create_group]]</h4>
				</div>
				<div class="modal-body">
					<div class="alert alert-danger hide" id="create-modal-error"></div>
					<form>
						<div class="form-group">
							<label for="group-name">[[admin:groups.group_name]]</label>
							<input type="text" class="form-control" id="create-group-name" placeholder="[[admin:groups.group_name]]" />
						</div>
						<div class="form-group">
							<label for="group-name">[[admin:groups.description]]</label>
							<input type="text" class="form-control" id="create-group-desc" placeholder="[[admin:groups.description_placeholder]]" />
						</div>
					</form>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-default" data-dismiss="modal">[[admin:groups.close]]</button>
					<button type="button" class="btn btn-primary" id="create-modal-go">[[admin:groups.create]]</button>
				</div>
			</div>
		</div>
	</div>

</div>




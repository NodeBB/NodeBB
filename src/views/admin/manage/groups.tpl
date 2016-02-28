<div class="groups">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-body">
				<table class="table table-striped groups-list">
					<tr>
						<th>Group Name</th>
						<th>Group Description</th>
					</tr>
					<!-- BEGIN groups -->
					<tr data-groupname="{groups.displayName}">
						<td>
							{groups.displayName}
							<!-- IF groups.system -->
							<span class="badge">System Group</span>
							<!-- ENDIF groups.system -->
						</td>
						<td>
							<div class="btn-group pull-right">
								<a href="{config.relative_path}/admin/manage/groups/{groups.nameEncoded}" class="btn btn-default btn-xs"><i class="fa fa-edit"></i> Edit</a>
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
			<div class="panel-body">
				<div>
					<input id="group-search" type="text" class="form-control" placeholder="Search" />
				</div>
			</div>
		</div>
	</div>

	<div class="modal fade" id="create-modal">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h4 class="modal-title">Create Group</h4>
				</div>
				<div class="modal-body">
					<div class="alert alert-danger hide" id="create-modal-error"></div>
					<form>
						<div class="form-group">
							<label for="group-name">Group Name</label>
							<input type="text" class="form-control" id="create-group-name" placeholder="Group Name" />
						</div>
						<div class="form-group">
							<label for="group-name">Description</label>
							<input type="text" class="form-control" id="create-group-desc" placeholder="A short description about your group" />
						</div>
					</form>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
					<button type="button" class="btn btn-primary" id="create-modal-go">Create</button>
				</div>
			</div>
		</div>
	</div>

</div>


<button id="create" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
    <i class="material-icons">add</i>
</button>

<div class="groups">
	<div class="col-sm-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-group"></i> Groups List</div>
			<div class="panel-body">	
				<ul id="groups-list">
				<!-- BEGIN groups -->
					<li data-groupname="{groups.name}">
						<div class="row">
							<div class="col-lg-8">
								<h2>
									{groups.name}
									<!-- IF groups.system -->
									<span class="badge">System Group</span>
									<!-- ENDIF groups.system -->
								</h2>
								<p>{groups.description}</p>

								<div class="btn-group">
									<button class="btn btn-default" data-action="members">Edit</button>
									<!-- IF groups.deletable -->
									<button class="btn btn-danger" data-action="delete">Delete Group</button>
									<!-- ENDIF groups.deletable -->
								</div>
							</div>
							<div class="col-lg-4">
								<ul class="pull-right members">
								<!-- BEGIN members --><li data-uid="{groups.members.uid}" data-toggle="tooltip" title="{groups.members.username}"><img src="{groups.members.picture}" /></li><!-- END members -->
								<!-- IF groups.truncated --><li data-toggle="tooltip" title="Total: {groups.memberCount}" class="more"><i class="fa fa-users fa-2x"></i></li><!-- ENDIF groups.truncated -->
								</ul>
							</div>
						</div>
					</li>
				<!-- END groups -->
				</ul>				
			</div>
		</div>
	</div>

	<div class="col-lg-3">
		<div class="panel panel-default">
			<div class="panel-heading">Groups Control Panel</div>
			<div class="panel-body">
				<div>
					<button class="btn btn-primary" id="create">New Group</button>
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

	<div class="modal fade" id="group-details-modal">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h4 class="modal-title">Manage Group</h4>
				</div>
				<div class="modal-body">
					<div class="alert alert-danger hide" id="create-modal-error"></div>
					<form>
						<div class="form-group">
							<label for="change-group-name">Group Name</label>
							<input type="text" class="form-control" id="change-group-name" placeholder="Group Name" />
						</div>
						<div class="form-group">
							<label for="change-group-desc">Description</label>
							<input type="text" class="form-control" id="change-group-desc" placeholder="A short description about your group" />
						</div>
						<div class="form-group">
							<label for="change-group-user-title">Title of Members</label>
							<input type="text" class="form-control" id="change-group-user-title" placeholder="The title of users if they are a member of this group" />
						</div>
						<div class="form-group">
							<label for="change-group-icon">Group Icon</label><br/>
							<i id="group-icon" class="fa fa-shield fa-2x"></i>
							<button type="button" class="btn btn-default btn-sm" id="change-group-icon" placeholder="">Change Icon</button>
						</div>
						<div class="form-group">
							<label for="change-group-label-color">Group Label Color</label>
							<span id="group-label-preview" class="label label-default"></span>
							<input id="change-group-label-color" placeholder="#0059b2" data-name="bgColor" value="" class="form-control" />
						</div>
						<div class="form-group">
							<label>Members</label>
							<p>Click on a user to remove them from the group</p>
							<ul class="members current_members" id="group-details-members"></ul>
						</div>
						<div class="form-group">
							<label for="add-member">Add User to Group</label>
							<input type="text" class="form-control" id="group-details-search" placeholder="Search Users" />
							<ul class="members" id="group-details-search-results"></ul>
						</div>
					</form>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-primary" id="details-modal-save" data-dismiss="modal">Save</button>
				</div>
			</div>
		</div>
	</div>
</div>

<input type="hidden" template-variable="yourid" value="{yourid}" />

<div id="icons" style="display:none;">
	<div class="icon-container">
		<div class="row fa-icons">
			<i class="fa fa-doesnt-exist"></i>
			<!-- IMPORT admin/partials/fontawesome.tpl -->
		</div>
	</div>
</div>

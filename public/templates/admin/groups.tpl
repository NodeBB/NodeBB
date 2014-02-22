<h1><i class="fa fa-group"></i> Groups</h1>

<hr />

<div class="groups">
	<ul id="groups-list">
	<!-- BEGIN groups -->
		<li data-gid="{groups.gid}">
			<div class="row">
				<div class="col-lg-8">
					<h2>{groups.name}</h2>
					<p>{groups.description}</p>
					<!-- IF groups.deletable -->
					<div class="btn-group">
						<button class="btn btn-default" data-action="members">Members</button>
						<button class="btn btn-danger" data-action="delete">Delete Group</button>
					</div>
					<!-- ENDIF groups.deletable -->
				</div>
				<div class="col-lg-4">
					<ul class="pull-right members">
					<!-- BEGIN members --><li data-uid="{groups.members.uid}" title="{groups.members.username}"><img src="{groups.members.picture}" /></li><!-- END members -->
					</ul>
				</div>
			</div>
		</li>
	<!-- END groups -->
	</ul>

	<div class="text-center">
		<button class="btn btn-primary" id="create">New Group</button>
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
							<label for="group-name">Group Name</label>
							<input type="text" class="form-control" id="change-group-name" placeholder="Group Name" />
						</div>
						<div class="form-group">
							<label for="group-name">Description</label>
							<input type="text" class="form-control" id="change-group-desc" placeholder="A short description about your group" />
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
					<button type="button" class="btn btn-primary" data-dismiss="modal">Close</button>
				</div>
			</div>
		</div>
	</div>
</div>
<input type="hidden" template-variable="yourid" value="{yourid}" />

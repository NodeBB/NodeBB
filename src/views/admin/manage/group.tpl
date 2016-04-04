<div class="row">
	<form role="form" class="group" data-groupname="{group.displayName}">
		<div class="col-md-9">
			<div class="group-settings-form">
				<fieldset>
					<label for="change-group-name">Name</label>
					<input type="text" class="form-control" id="change-group-name" placeholder="Group Name" value="{group.displayName}" <!-- IF group.system -->readonly<!-- ENDIF group.system -->/><br />
				</fieldset>

				<fieldset>
					<label for="change-group-desc">Description</label>
					<input type="text" class="form-control" id="change-group-desc" placeholder="A short description about your group" value="{group.description}" maxlength="255" /><br />
				</fieldset>

				<fieldset>
					<label for="change-group-user-title">Title of Members</label>
					<input type="text" class="form-control" id="change-group-user-title" placeholder="The title of users if they are a member of this group" value="{group.userTitle}" maxlength="40" /><br />
				</fieldset>

				<fieldset>
					<label for="change-group-icon">Group Icon</label><br/>
					<i id="group-icon" class="fa fa-2x <!-- IF group.icon -->{group.icon}<!-- ELSE -->fa-shield<!-- ENDIF group.icon -->" value="{group.icon}"></i><br />
				</fieldset>

				<fieldset>
					<label for="change-group-label-color">Group Label Color</label>
					<span id="group-label-preview" class="label label-default" style="background:<!-- IF group.labelColor -->{group.labelColor}<!-- ELSE -->#000000<!-- ENDIF group.labelColor -->;">{group.userTitle}</span>
					<input id="change-group-label-color" placeholder="#0059b2" data-name="bgColor" value="{group.labelColor}" class="form-control" /><br />
				</fieldset>

				<fieldset>
					<div class="checkbox">
						<label>
							<input id="group-userTitleEnabled" name="userTitleEnabled" type="checkbox"<!-- IF group.userTitleEnabled --> checked<!-- ENDIF group.userTitleEnabled -->> <strong>Show Badge</strong>
						</label>
					</div>
				</fieldset>

				<fieldset>
					<div class="checkbox">
						<label>
							<input id="group-private" name="private" type="checkbox"<!-- IF group.private --> checked<!-- ENDIF group.private -->> <strong>[[groups:details.private]]</strong>
							<p class="help-block">
								If enabled, joining of groups requires approval from a group owner.
							</p>
							<!-- IF !allowPrivateGroups -->
							<p class="help-block">
								Warning: Private groups is disabled at system level, which overrides this option.
							</p>
							<!-- ENDIF !allowPrivateGroups -->
						</label>
					</div>
				</fieldset>

				<fieldset>
					<div class="checkbox">
						<label>
							<input id="group-disableJoinRequests" name="disableJoinRequests" type="checkbox"<!-- IF group.disableJoinRequests --> checked<!-- ENDIF group.disableJoinRequests -->> <strong>Disable join requests</strong>
						</label>
					</div>
				</fieldset>

				<fieldset>
					<div class="checkbox">
						<label>
							<input id="group-hidden" name="hidden" type="checkbox"<!-- IF group.hidden --> checked<!-- ENDIF group.hidden -->> <strong>Hidden</strong>
							<p class="help-block">
								If enabled, this group will not be found in the groups listing, and users will have to be invited manually
							</p>
						</label>
					</div>
				</fieldset>

				<fieldset>
					<label for="add-member">Add User to Group</label>
					<input type="text" class="form-control" id="group-details-search" placeholder="Search Users" />
					<ul class="members user-list" id="group-details-search-results"></ul>

				</fieldset>

				<fieldset>
					<div class="panel panel-default">
						<div class="panel-heading">
							<h3 class="panel-title"><i class="fa fa-users"></i> Member List</h3>
						</div>
						<div class="panel-body">
							<!-- IMPORT partials/groups/memberlist.tpl -->
						</div>
					</div>


				</fieldset>
			</div>
		</div>

		<div class="col-md-3 options acp-sidebar">
			<div class="panel panel-default">
				<div class="panel-heading">Groups Control Panel</div>
				<div class="panel-body">
					<div class="btn-group btn-group-justified">
						<div class="btn-group">
							<button class="btn btn-primary save">Save</button>
						</div>
						<div class="btn-group">
							<button class="btn btn-default revert">Revert</button>
						</div>
					</div>
				</div>
			</div>
		</div>

	</form>
</div>

<div id="icons" style="display:none;">
	<div class="icon-container">
		<div class="row fa-icons">
			<i class="fa fa-doesnt-exist"></i>
			<!-- IMPORT partials/fontawesome.tpl -->
		</div>
	</div>
</div>


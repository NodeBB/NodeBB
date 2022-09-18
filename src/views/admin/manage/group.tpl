<div>
	<form role="form" class="group row" data-groupname="{group.displayName}">
		<div class="col-md-9">
			<div class="group-settings-form">
				<fieldset class="mb-3">
					<label class="form-label" for="change-group-name">[[admin/manage/groups:edit.name]]</label>
					<input type="text" class="form-control" id="change-group-name" placeholder="Group Name" value="{group.displayName}" maxlength="{maximumGroupNameLength}" data-property <!-- IF group.system -->readonly<!-- ENDIF group.system -->/><br />
				</fieldset>

				<fieldset class="mb-3">
					<label class="form-label" for="change-group-desc">[[admin/manage/groups:edit.description]]</label>
					<input type="text" class="form-control" id="change-group-desc" placeholder="A short description about your group" value="{group.description}" maxlength="255" data-property /><br />
				</fieldset>

				<div class="row mb-3">
					<div class="col-md-4">
						<fieldset>
							<label class="form-label" for="change-group-user-title">[[admin/manage/groups:edit.user-title]]</label>
							<span id="group-label-preview" class="badge" style="color:<!-- IF group.textColor -->{group.textColor}<!-- ELSE -->#ffffff<!-- ENDIF group.textColor -->; background:<!-- IF group.labelColor -->{group.labelColor}<!-- ELSE -->#000000<!-- ENDIF group.labelColor -->;"><i id="group-icon-preview" class="fa {group.icon} <!-- IF !group.icon -->hidden<!-- ENDIF -->"></i> <span id="group-label-preview-text">{group.userTitle}</span></span>
							<input type="text" class="form-control" id="change-group-user-title" placeholder="The title of users if they are a member of this group" value="{group.userTitleEscaped}" maxlength="{maximumGroupTitleLength}" data-property /><br />
						</fieldset>
					</div>
					<div class="col-md-2">
						<fieldset>
							<label class="form-label" id="group-icon-label" for="change-group-icon">[[admin/manage/groups:edit.icon]]</label><br/>
							<i id="group-icon" class="fa fa-2x <!-- IF group.icon -->{group.icon}<!-- ENDIF group.icon -->" value="{group.icon}"></i><br />
						</fieldset>
					</div>
					<div class="col-md-3">
						<fieldset>
							<label class="form-label" for="change-group-label-color">[[admin/manage/groups:edit.label-color]]</label>

							<input type="color" id="change-group-label-color" placeholder="#0059b2" data-name="bgColor" value="{group.labelColor}" class="form-control" data-property/><br />
						</fieldset>
					</div>
					<div class="col-md-3">
						<fieldset>
							<label class="form-label" for="change-group-text-color">[[admin/manage/groups:edit.text-color]]</label>
							<input type="color" id="change-group-text-color" placeholder="#ffffff" data-name="textColor" value="{group.textColor}" class="form-control" data-property/><br />
						</fieldset>
					</div>
				</div>

				<fieldset class="mb-3">
					<div class="checkbox">
						<label>
							<input id="group-userTitleEnabled" name="userTitleEnabled" data-property type="checkbox"<!-- IF group.userTitleEnabled --> checked<!-- ENDIF group.userTitleEnabled -->> <strong>[[admin/manage/groups:edit.show-badge]]</strong>
						</label>
					</div>
				</fieldset>

				<fieldset class="mb-3">
					<div class="checkbox">
						<label>
							<input id="group-private" name="private" data-property type="checkbox"<!-- IF group.private --> checked<!-- ENDIF group.private -->>
							<strong>[[groups:details.private]]</strong>
							<p class="form-text">
								[[admin/manage/groups:edit.private-details]]
							</p>
							<!-- IF !allowPrivateGroups -->
							<p class="form-text">
								[[admin/manage/groups:edit.private-override]]
							</p>
							<!-- ENDIF !allowPrivateGroups -->
						</label>
					</div>
				</fieldset>

				<fieldset class="mb-3">
					<div class="checkbox">
						<label>
							<input id="group-disableJoinRequests" name="disableJoinRequests" data-property type="checkbox"<!-- IF group.disableJoinRequests --> checked<!-- ENDIF group.disableJoinRequests -->>
							<strong>[[admin/manage/groups:edit.disable-join]]</strong>
						</label>
					</div>
				</fieldset>

				<fieldset class="mb-3">
					<div class="checkbox">
						<label>
							<input id="group-disableLeave" name="disableLeave" data-property type="checkbox"{{{if group.disableLeave}}} checked{{{end}}}>
							<strong>[[admin/manage/groups:edit.disable-leave]]</strong>
						</label>
					</div>
				</fieldset>

				<fieldset class="mb-3">
					<div class="checkbox">
						<label>
							<input id="group-hidden" name="hidden" data-property type="checkbox"<!-- IF group.hidden --> checked<!-- ENDIF group.hidden -->>
							<strong>[[admin/manage/groups:edit.hidden]]</strong>
							<p class="form-text">
								[[admin/manage/groups:edit.hidden-details]]
							</p>
						</label>
					</div>
				</fieldset>

				<hr />

				<div class="mb-3">
					<label class="form-label" for="memberPostCids">[[groups:details.member-post-cids]]</label>
					<div class="row">
						<div class="col-md-9">
							<input id="memberPostCids" type="text" class="form-control" value="{group.memberPostCids}">
						</div>
						<div class="col-md-3 member-post-cids-selector">
							<!-- IMPORT partials/category-selector.tpl -->
						</div>
					</div>
				</div>

				<hr />

				<fieldset>
					<div class="card">
						<div class="card-header">
							<h5 class="card-title"><i class="fa fa-users"></i> [[admin/manage/groups:edit.members]]</h5>
						</div>
						<div class="card-body">
							<!-- IMPORT admin/partials/groups/memberlist.tpl -->
						</div>
					</div>
				</fieldset>
			</div>
		</div>
		<div class="col-md-3">
			<div component="group-selector" class="btn-group">
				<button type="button" class="btn btn-outline-secondary dropdown-toggle w-100" data-bs-toggle="dropdown">
					<span component="group-selector-selected">{group.displayName}</span> <span class="caret"></span>
				</button>
				<div component="group-selector-search" class="hidden position-absolute w-100">
					<input type="text" class="form-control" autocomplete="off">
				</div>
				<ul component="group-list" class="dropdown-menu dropdown-menu-end group-dropdown-menu" role="menu">
					<li component="group-no-matches" role="presentation" class="group hidden">
						<a class="dropdown-item" role="menuitem">[[search:no-matches]]</a>
					</li>
					<!-- BEGIN groupNames -->
					<li role="presentation" class="group" data-name="{groupNames.displayName}">
						<a class="dropdown-item" href="{config.relative_path}/admin/manage/groups/{groupNames.encodedName}" role="menuitem">{groupNames.displayName}</a>
					</li>
					<!-- END groupNames -->
				</ul>
			</div>
			<hr />
			<div class="edit-privileges-selector">
				<label class="form-label" class="float-start">[[admin/manage/privileges:edit-privileges]]</label>
				<!-- IMPORT partials/category-selector.tpl -->
			</div>
		</div>
	</form>
</div>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
    <i class="material-icons">save</i>
</button>

<div id="icons" style="display:none;">
	<div class="icon-container">
		<div class="row nbb-fa-icons">
			<!-- IMPORT partials/fontawesome.tpl -->
		</div>
	</div>
</div>

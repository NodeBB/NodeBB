<div class="acp-page-container px-lg-4">


	<div component="settings/main/header" class="row border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center">
		<div class="col-12 col-md-8 px-0 mb-1 mb-md-0 d-flex justify-content-between align-items-center">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/manage/groups:edit-group]]</h4>

			<div component="group-selector" class="btn-group">
				<button type="button" class="btn btn-ghost btn-sm dropdown-toggle w-100" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
					<span component="group-selector-selected">{group.displayName}</span> <span class="caret"></span>
				</button>

				<div class="dropdown-menu p-1">
					<div component="group-selector-search" class="p-1 hidden">
						<input type="text" class="form-control form-control-sm" placeholder="[[search:type-to-search]]" autocomplete="off">
						<hr class="mt-2 mb-0"/>
					</div>
					<ul component="group-list" class="list-unstyled mb-0 text-sm dropdown-menu-end group-dropdown-menu overflow-auto ghost-scrollbar" role="menu" style="max-height: 500px;">
						<li component="group-no-matches" role="presentation" class="group hidden">
							<a class="dropdown-item rounded-1" role="menuitem">[[search:no-matches]]</a>
						</li>
						{{{ each groupNames }}}
						<li role="presentation" class="group" data-name="{./displayName}">
							<a class="dropdown-item rounded-1" href="{config.relative_path}/admin/manage/groups/{./slug}" role="menuitem">{./displayName}</a>
						</li>
						{{{ end }}}
					</ul>
				</div>
			</div>
		</div>
		<div class="col-12 col-md-4 px-0 px-md-3 ">
			<button id="save" class="btn btn-primary btn-sm btn btn-primary btn-sm fw-semibold ff-secondary w-100 text-center text-nowrap">[[admin/admin:save-changes]]</button>
		</div>
	</div>


	<div class="row m-0" data-groupname="{group.displayName}">
		<div class="col-12 col-md-8 px-0">
			<div class="group-settings-form">
				<div class="mb-3">
					<label class="form-label" for="change-group-name">[[admin/manage/groups:edit.name]]</label>
					<input type="text" class="form-control" id="change-group-name" value="{group.displayName}" maxlength="{maximumGroupNameLength}" data-property {{{ if group.system }}}readonly{{{ end }}}/>
				</div>

				<div class="mb-3">
					<label class="form-label" for="change-group-desc">[[admin/manage/groups:edit.description]]</label>
					<input type="text" class="form-control" id="change-group-desc" value="{group.description}" maxlength="255" data-property />
				</div>


				<div class="mb-3 d-flex flex-column gap-1">
					<div class="d-flex gap-2">
						<label class="form-label" for="category-image">
							[[admin/manage/groups:icon-and-title]]
						</label>
						<span id="group-label-preview" class="badge" style="color:{{{ if group.textColor }}}{group.textColor}{{{ else }}}#ffffff{{{ end }}}; background:{{{ if group.labelColor }}}{group.labelColor}{{{ else }}}#000000{{{ end }}};"><i id="group-icon-preview" class="fa {group.icon} {{{ if !group.icon }}}hidden{{{ end }}}"></i> <span id="group-label-preview-text">{group.userTitle}</span></span>
					</div>

					<div class="d-flex gap-2 align-items-center">
						<div class="pointer border rounded-1 p-1 d-flex align-items-center justify-content-center" id="group-icon-container" style="width:40px; height:40px;" data-bs-toggle="tooltip" title="[[admin/admin:select-icon]]">
							<i id="group-icon" class="fa fa-2x {{{ if group.icon }}}{group.icon}{{{ end }}}" value="{group.icon}"></i>
						</div>
						<div class="w-100">
							<input type="text" class="form-control" id="change-group-user-title" placeholder="The title of users if they are a member of this group" value="{group.userTitleEscaped}" maxlength="{maximumGroupTitleLength}" data-property />
						</div>
					</div>
				</div>

				<div class="mb-3 d-flex justify-content-between align-items-center gap-2">
					<label class="form-label text-nowrap" for="change-group-label-color">[[admin/manage/groups:edit.label-color]]</label>
					<!-- added this to match the height of other blocks -->
					<input type="text" class="form-control invisible" style="width: 0px;">
					<input type="color" id="change-group-label-color" placeholder="#0059b2" data-name="bgColor" value="{group.labelColor}" class="form-control p-1 h-auto align-self-stretch" data-property style="max-width: 64px;" />
				</div>

				<div class="mb-3 d-flex justify-content-between align-items-center gap-2">
					<label class="form-label text-nowrap" for="change-group-text-color">[[admin/manage/groups:edit.text-color]]</label>
					<!-- added this to match the height of other blocks -->
					<input type="text" class="form-control invisible" style="width: 0px;">
					<input type="color" id="change-group-text-color" placeholder="#ffffff" data-name="textColor" value="{group.textColor}" class="form-control p-1 h-auto align-self-stretch" data-property style="max-width: 64px;"/>
				</div>

				<div class="mb-3">
					<div class="form-check form-switch">
						<input class="form-check-input" id="group-userTitleEnabled" name="userTitleEnabled" data-property type="checkbox"{{{ if group.userTitleEnabled }}} checked{{{ end }}}>
						<label class="form-check-label" for="group-userTitleEnabled">[[admin/manage/groups:edit.show-badge]]</label>
					</div>
				</div>

				<div class="mb-3">
					<div class="form-check form-switch">
						<input class="form-check-input" id="group-private" name="private" data-property type="checkbox"{{{ if group.private }}} checked{{{ end }}}>
						<label class="form-check-label" for="group-private">[[groups:details.private]]</label>
					</div>
					<p class="form-text">
						[[admin/manage/groups:edit.private-details]]
					</p>
					{{{ if !allowPrivateGroups }}}
					<p class="form-text">
						[[admin/manage/groups:edit.private-override]]
					</p>
					{{{ end }}}
				</div>

				<div class="mb-3">
					<div class="form-check form-switch">
						<input class="form-check-input" id="group-disableJoinRequests" name="disableJoinRequests" data-property type="checkbox"{{{ if group.disableJoinRequests }}} checked{{{ end }}}>
						<label class="form-check-label" for="group-disableJoinRequests">[[admin/manage/groups:edit.disable-join]]</label>
					</div>
				</div>

				<div class="mb-3">
					<div class="form-check form-switch">
						<input class="form-check-input" id="group-disableLeave" name="disableLeave" data-property type="checkbox"{{{if group.disableLeave}}} checked{{{end}}}>
						<label class="form-check-label" for="group-disableLeave">[[admin/manage/groups:edit.disable-leave]]</label>
					</div>
				</div>

				<div class="mb-3">
					<div class="form-check form-switch">
						<input class="form-check-input" id="group-hidden" name="hidden" data-property type="checkbox"{{{ if group.hidden }}} checked{{{ end }}}>
						<label class="form-check-label" for="group-hidden">[[admin/manage/groups:edit.hidden]]</label>
						<p class="form-text">
							[[admin/manage/groups:edit.hidden-details]]
						</p>
					</div>
				</div>

				<hr />

				<div class="d-flex flex-column gap-1 mb-3">
					<label class="form-label" for="memberPostCids" for="memberPostCids">[[groups:details.member-post-cids]]</label>
					<div class="d-flex gap-1 align-items-center">
						<div class="member-post-cids-selector">
							<!-- IMPORT admin/partials/category/selector-dropdown-left.tpl -->
						</div>
						<input id="memberPostCids" type="text" class="form-control form-control-sm" value="{group.memberPostCids}">
					</div>
				</div>

				<hr />

				<div class="d-flex flex-column gap-2">
					<label class="form-label">[[admin/manage/groups:edit.members]]</label>

					<div class="">
						<!-- IMPORT admin/partials/groups/memberlist.tpl -->
					</div>
				</div>
			</div>
		</div>

		<div class="col-12 col-md-4 px-0 px-md-3 acp-sidebar">
			<div class="p-2 d-flex flex-column text-bg-light border rounded-1 gap-1">
				<a href="{config.relative_path}/admin/manage/groups" class="btn btn-ghost btn-sm d-flex gap-2 align-items-center"><i class="fa fa-fw fa-chevron-left text-primary"></i> [[admin/manage/groups:back-to-groups]]</a>

				<hr class="my-1"/>

				<div class="edit-privileges-selector w-100">
					<div component="category-selector" class="btn-group w-100">
						<button type="button" class="btn btn-ghost btn-sm d-flex gap-2 align-items-center flex-fill dropdown-toggle" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
							<i class="fa fa-fw fa-lock text-primary"></i> <span>[[admin/manage/groups:privileges]]</span> <span class="caret"></span>
						</button>

						<div class="dropdown-menu p-1">
							<div component="category-selector-search" class="p-1 hidden">
								<input type="text" class="form-control form-control-sm" placeholder="[[search:type-to-search]]" autocomplete="off">
								<hr class="mt-2 mb-0"/>
							</div>
							<ul component="category/list" class="list-unstyled mb-0 text-sm category-dropdown-menu dropdown-menu-end ghost-scrollbar" role="menu">
								<li component="category/no-matches" role="presentation" class="category hidden">
									<a class="dropdown-item" role="menuitem">[[search:no-matches]]</a>
								</li>
								{{{each categories}}}
								<li role="presentation" class="category {{{ if categories.disabledClass }}}disabled{{{ end }}}" data-cid="{categories.cid}" data-name="{categories.name}" data-parent-cid="{categories.parentCid}">
									<a class="dropdown-item rounded-1" role="menuitem">{categories.level}
										<span component="category-markup">
											<div class="category-item d-inline-block">
												{buildCategoryIcon(@value, "24px", "rounded-circle")}
												{./name}
											</div>
										</span>
									</a>
								</li>
								{{{end}}}
							</ul>
						</div>
					</div>
				</div>

				<a href="{config.relative_path}/api/admin/groups/{group.nameEncoded}/csv" class="btn btn-ghost btn-sm d-flex gap-2 align-items-center">
					<i class="fa fa-fw fa-file-csv text-primary"></i>[[admin/manage/groups:members-csv]]</a>

				<a href="{config.relative_path}/groups/{group.slug}" class="btn btn-ghost btn-sm d-flex gap-2 align-items-center">
					<i class="fa fa-fw fa-eye text-primary"></i> [[admin/manage/groups:view-group]]
				</a>

				<hr class="my-1"/>

				<button data-action="delete" class="btn btn-ghost btn-sm d-flex gap-2 align-items-center">
					<i class="fa fa-fw fa-trash text-danger"></i> [[admin/manage/groups:delete]]
				</button>
			</div>
		</div>
	</form>
</div>

<div id="icons" style="display:none;">
	<div class="icon-container">
		<div class="row nbb-fa-icons">
			<!-- IMPORT partials/fontawesome.tpl -->
		</div>
	</div>
</div>

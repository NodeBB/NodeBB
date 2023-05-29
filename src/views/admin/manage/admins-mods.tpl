<div class="admins-mods acp-page-container px-lg-4">
	<div>
		<div class="d-flex gap-2 justify-content-between align-items-center mb-2">
			<h4 class="mb-0">{{{ if admins.icon }}}<i class="fa {admins.icon}"></i> {{{ end }}}[[admin/manage/admins-mods:administrators]]</h4>
			<input id="admin-search" class="form-control form-control-sm w-auto" placeholder="[[admin/manage/admins-mods:add-administrator]]" />
		</div>
		<div class="administrator-area">
		{{{ each admins.members }}}
			<div class="badge text-bg-light m-1 p-1" data-uid="{admins.members.uid}">
				{buildAvatar(admins.members, "24px", true)}
				<a href="{config.relative_path}/user/{admins.members.userslug}">{admins.members.username}</a>
				<i class="mx-1 remove-user-icon fa fa-times" role="button"></i>
			</div>
		{{{ end }}}
		</div>
	</div>

	<hr/>

	<div>
		<div class="d-flex gap-2 justify-content-between align-items-center mb-2">
			<h4 class="mb-0">{{{ if globalMods.icon }}}<i class="fa {globalMods.icon}"></i> {{{ end }}}[[admin/manage/admins-mods:global-moderators]]</h4>
			<input id="global-mod-search" class="form-control form-control-sm w-auto" placeholder="[[admin/manage/admins-mods:add-global-moderator]]" />
		</div>
		<div class="global-moderator-area mb-2">
		{{{ each globalMods.members }}}
			<div class="badge text-bg-light  m-1 p-1" data-uid="{globalMods.members.uid}">
				{buildAvatar(globalMods.members, "24px", true)}
				<a href="{config.relative_path}/user/{globalMods.members.userslug}">{globalMods.members.username}</a>
				<i class="mx-1 remove-user-icon fa fa-times" role="button"></i>
			</div>
		{{{ end }}}
		</div>

		<div id="no-global-mods-warning" class="text-sm text-muted mb-0 {{{ if globalMods.members.length }}}hidden{{{ end }}}">[[admin/manage/admins-mods:no-global-moderators]]</div>
	</div>

	<hr/>

	<div>
		<div class="d-flex gap-2 align-items-center">
			<h4 class="mb-0" id="moderators-title">[[admin/manage/admins-mods:moderators]]</h4>
			<div class="">
				<!-- IMPORT admin/partials/category/selector-dropdown-left.tpl -->
			</div>
		</div>
		<div class="mb-2">
		<!-- IMPORT partials/breadcrumbs.tpl -->
		</div>
		{{{ if !categoryMods.length }}}
		<p class="alert alert-info">[[admin/manage/admins-mods:no-sub-categories]]</p>
		{{{ end }}}

		{{{ each categoryMods }}}
		{{{ if @first }}}
		<hr>
		{{{ end }}}
		<div class="categories category-wrapper mb-4">
			<div class="d-flex gap-2 justify-content-between align-items-center mb-2">
				<div class="d-flex gap-2 align-items-center">
					<div class="d-flex gap-1 align-items-center">
						{buildCategoryIcon(@value, "28px", "rounded-1")}
						<h5 class="mb-0">{categoryMods.name}</h5>
					</div>
					{{{ if categoryMods.subCategoryCount }}}
					<a class="btn btn-light btn-sm" href="{config.relative_path}/admin/manage/admins-mods?cid={categoryMods.cid}#moderators-title">[[admin/manage/admins-mods:view-children, {categoryMods.subCategoryCount}]]</a>
					{{{ end }}}
					{{{if categoryMods.disabled}}}<span class="badge text-bg-warning">[[admin/manage/admins-mods:disabled]]</span>{{{end}}}
				</div>
				<input data-cid="{categoryMods.cid}" class="form-control form-control-sm moderator-search w-auto" placeholder="[[admin/manage/admins-mods:add-moderator]]" />
			</div>



			<div class="moderator-area" data-cid="{categoryMods.cid}">
				{{{ each categoryMods.moderators }}}
					<div class="badge text-bg-light m-1 p-1" data-uid="{categoryMods.moderators.uid}">
						{buildAvatar(categoryMods.moderators, "24px", true)}
						<a href="{config.relative_path}/user/{categoryMods.moderators.userslug}">{categoryMods.moderators.username}</a>
						<i class="mx-1 remove-user-icon fa fa-times" role="button"></i>
					</div>
				{{{ end }}}
			</div>

			<div data-cid="{categoryMods.cid}" class="no-moderator-warning text-sm text-muted {{{ if categoryMods.moderators.length }}}hidden{{{ end }}}">[[admin/manage/admins-mods:no-moderators]]</div>

		</div>
		<hr >
		{{{ end }}}
		<div>
			<!-- IMPORT admin/partials/paginator.tpl -->
		</div>
	</div>
</div>

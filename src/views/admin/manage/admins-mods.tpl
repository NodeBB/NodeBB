<div class="admins-mods">
	<div class="mb-5">
		<h4>{{{ if admins.icon }}}<i class="fa {admins.icon}"></i> {{{ end }}}[[admin/manage/admins-mods:administrators]]</h4>
		<div class="administrator-area">
		{{{ each admins.members }}}
			<div class="badge text-bg-light m-1 p-1 float-start" data-uid="{admins.members.uid}">
				{buildAvatar(admins.members, "24px", true)}
				<a href="{config.relative_path}/user/{admins.members.userslug}">{admins.members.username}</a>
				<i class="mx-1 remove-user-icon fa fa-times" role="button"></i>
			</div>
		{{{ end }}}
		</div>
		<input id="admin-search" class="form-control" placeholder="[[admin/manage/admins-mods:add-administrator]]" />
	</div>

	<div class="mb-5">
		<h4>{{{ if globalMods.icon }}}<i class="fa {globalMods.icon}"></i> {{{ end }}}[[admin/manage/admins-mods:global-moderators]]</h4>
		<div class="global-moderator-area">
		{{{ each globalMods.members }}}
			<div class="badge text-bg-light  m-1 p-1 float-start" data-uid="{globalMods.members.uid}">
				{buildAvatar(globalMods.members, "24px", true)}
				<a href="{config.relative_path}/user/{globalMods.members.userslug}">{globalMods.members.username}</a>
				<i class="mx-1 remove-user-icon fa fa-times" role="button"></i>
			</div>
		{{{ end }}}
		</div>

		<div id="no-global-mods-warning" class="alert alert-info {{{ if globalMods.members.length }}}hidden{{{ end }}}">[[admin/manage/admins-mods:no-global-moderators]]</div>

		<input id="global-mod-search" class="form-control" placeholder="[[admin/manage/admins-mods:add-global-moderator]]" />
	</div>

	<div>
		<h4 id="moderators-title">[[admin/manage/admins-mods:moderators]]</h4>

		<!-- IMPORT partials/breadcrumbs.tpl -->
		<div class="mb-3">
		<!-- IMPORT admin/partials/category/selector-dropdown-left.tpl -->
		</div>
		{{{ if !categoryMods.length }}}
		<div><p class="alert alert-info">[[admin/manage/admins-mods:no-sub-categories]]</p></div>
		{{{ end }}}

		{{{ each categoryMods }}}
		<div class="categories category-wrapper mb-4">
			<div class="float-start me-1">{buildCategoryIcon(@value, "24px", "rounded-circle")}</div>
			<h4>{categoryMods.name} {{{ if categoryMods.subCategoryCount }}}<small><a href="{config.relative_path}/admin/manage/admins-mods?cid={categoryMods.cid}#moderators-title">[[admin/manage/admins-mods:subcategories, {categoryMods.subCategoryCount}]]</a></small>{{{ else }}}{{{ end }}}{{{if categoryMods.disabled}}}<span class="badge bg-warning">[[admin/manage/admins-mods:disabled]]</span>{{{end}}}</h4>
			<div class="moderator-area" data-cid="{categoryMods.cid}">
				{{{ each categoryMods.moderators }}}
					<div class="badge text-bg-light m-1 p-1 float-start" data-uid="{categoryMods.moderators.uid}">
						{buildAvatar(categoryMods.moderators, "24px", true)}
						<a href="{config.relative_path}/user/{categoryMods.moderators.userslug}">{categoryMods.moderators.username}</a>
						<i class="mx-1 remove-user-icon fa fa-times" role="button"></i>
					</div>
				{{{ end }}}
			</div>

			<div data-cid="{categoryMods.cid}" class="no-moderator-warning {{{ if categoryMods.moderators.length }}}hidden{{{ end }}}">[[admin/manage/admins-mods:no-moderators]]</div>

			<input data-cid="{categoryMods.cid}" class="form-control moderator-search" placeholder="[[admin/manage/admins-mods:add-moderator]]" />
		</div>

		{{{ end }}}
		<div>
			<!-- IMPORT partials/paginator.tpl -->
		</div>
	</div>
</div>

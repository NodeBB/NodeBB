<div class="admins-mods">
	<div class="mb-3">
		<h4><!-- IF admins.icon --><i class="fa {admins.icon}"></i> <!-- ENDIF admins.icon -->[[admin/manage/admins-mods:administrators]]</h4>
		<div class="administrator-area">
		<!-- BEGIN admins.members -->
			<div class="badge text-bg-light m-1 p-1 float-start" data-uid="{admins.members.uid}">
				<!-- IF admins.members.picture -->
				<img class="avatar avatar-sm" src="{admins.members.picture}" alt="" />
				<!-- ELSE -->
				<div class="avatar avatar-sm" style="background-color: {admins.members.icon:bgColor};">{admins.members.icon:text}</div>
				<!-- ENDIF admins.members.picture -->
				<a href="{config.relative_path}/user/{admins.members.userslug}">{admins.members.username}</a>
				<i class="mx-1 remove-user-icon fa fa-times" role="button"></i>
			</div>
		<!-- END admins.members -->
		</div>
		<input id="admin-search" class="form-control" placeholder="[[admin/manage/admins-mods:add-administrator]]" />
	</div>

	<div class="mb-3">
		<h4><!-- IF globalMods.icon --><i class="fa {globalMods.icon}"></i> <!-- ENDIF globalMods.icon -->[[admin/manage/admins-mods:global-moderators]]</h4>
		<div class="global-moderator-area">
		<!-- BEGIN globalMods.members -->
			<div class="badge text-bg-light  m-1 p-1 float-start" data-uid="{globalMods.members.uid}">
				<!-- IF globalMods.members.picture -->
				<img class="avatar avatar-sm" src="{globalMods.members.picture}" alt="" />
				<!-- ELSE -->
				<div class="avatar avatar-sm" style="background-color: {globalMods.members.icon:bgColor};">{globalMods.members.icon:text}</div>
				<!-- ENDIF globalMods.members.picture -->
				<a href="{config.relative_path}/user/{globalMods.members.userslug}">{globalMods.members.username}</a>
				<i class="mx-1 remove-user-icon fa fa-times" role="button"></i>
			</div>
		<!-- END globalMods.members -->
		</div>

		<div id="no-global-mods-warning" class="alert alert-info {{{ if globalMods.members.length }}}hidden{{{ end }}}">[[admin/manage/admins-mods:no-global-moderators]]</div>

		<input id="global-mod-search" class="form-control" placeholder="[[admin/manage/admins-mods:add-global-moderator]]" />
	</div>

	<div>
		<h4 id="moderators-title">[[admin/manage/admins-mods:moderators]]</h4>

		<!-- IMPORT partials/breadcrumbs.tpl -->
		<div class="mb-3">
		<!-- IMPORT partials/category-selector.tpl -->
		</div>
		{{{ if !categoryMods.length }}}
		<div><p class="alert alert-info">[[admin/manage/admins-mods:no-sub-categories]]</p></div>
		{{{ end }}}

		{{{ each categoryMods }}}
		<div class="categories category-wrapper mb-2">
			<h4>{{{ if categoryMods.icon }}}<i class="fa {categoryMods.icon}"></i> {{{ end }}}{categoryMods.name} {{{ if categoryMods.subCategoryCount }}}<small><a href="{config.relative_path}/admin/manage/admins-mods?cid={categoryMods.cid}#moderators-title">[[admin/manage/admins-mods:subcategories, {categoryMods.subCategoryCount}]]</a></small>{{{ else }}}{{{ end }}}{{{if categoryMods.disabled}}}<span class="badge badge-primary">[[admin/manage/admins-mods:disabled]]</span>{{{end}}}</h4>
			<div class="moderator-area" data-cid="{categoryMods.cid}">
				{{{ each categoryMods.moderators }}}
					<div class="badge text-bg-light m-1 p-1 float-start" data-uid="{categoryMods.moderators.uid}">
						{{{ if  categoryMods.moderators.picture }}}
						<img class="avatar avatar-sm" src="{categoryMods.moderators.picture}" alt="" />
						{{{ else }}}
						<div class="avatar avatar-sm" style="background-color: {categoryMods.moderators.icon:bgColor};">{categoryMods.moderators.icon:text}</div>
						{{{ end }}}
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

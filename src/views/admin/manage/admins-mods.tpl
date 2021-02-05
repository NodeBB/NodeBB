<div class="admins-mods">
	<h4><!-- IF admins.icon --><i class="fa {admins.icon}"></i> <!-- ENDIF admins.icon -->[[admin/manage/admins-mods:administrators]]</h4>
	<div class="administrator-area">
	<!-- BEGIN admins.members -->
		<div class="user-card pull-left" data-uid="{admins.members.uid}">
			<!-- IF admins.members.picture -->
			<img class="avatar avatar-sm" src="{admins.members.picture}" />
			<!-- ELSE -->
			<div class="avatar avatar-sm" style="background-color: {admins.members.icon:bgColor};">{admins.members.icon:text}</div>
			<!-- ENDIF admins.members.picture -->
			<a href="{config.relative_path}/user/{admins.members.userslug}">{admins.members.username}</a>
			<i class="remove-user-icon fa fa-times" role="button"></i>
		</div>
	<!-- END admins.members -->
	</div>
	<input id="admin-search" class="form-control" placeholder="[[admin/manage/admins-mods:add-administrator]]" />

	<br/>

	<h4><!-- IF globalMods.icon --><i class="fa {globalMods.icon}"></i> <!-- ENDIF globalMods.icon -->[[admin/manage/admins-mods:global-moderators]]</h4>
	<div class="global-moderator-area">
	<!-- BEGIN globalMods.members -->
		<div class="user-card pull-left" data-uid="{globalMods.members.uid}">
			<!-- IF globalMods.members.picture -->
			<img class="avatar avatar-sm" src="{globalMods.members.picture}" />
			<!-- ELSE -->
			<div class="avatar avatar-sm" style="background-color: {globalMods.members.icon:bgColor};">{globalMods.members.icon:text}</div>
			<!-- ENDIF globalMods.members.picture -->
			<a href="{config.relative_path}/user/{globalMods.members.userslug}">{globalMods.members.username}</a>
			<i class="remove-user-icon fa fa-times" role="button"></i>
		</div>
	<!-- END globalMods.members -->
	</div>

	<div id="no-global-mods-warning" class="<!-- IF globalMods.members.length -->hidden<!-- ENDIF globalMods.members.length -->">[[admin/manage/admins-mods:no-global-moderators]]</div>

	<input id="global-mod-search" class="form-control" placeholder="[[admin/manage/admins-mods:add-global-moderator]]" />

	<br/>

	<!-- IMPORT partials/category-selector.tpl -->

	{{{ each categoryMods }}}
	<div class="categories category-wrapper category-depth-{categoryMods.depth}">
	<h4>{{{ if categoryMods.icon }}}<i class="fa {categoryMods.icon}"></i> {{{ end }}}[[admin/manage/admins-mods:moderators-of-category, {categoryMods.name}]]{{{if categoryMods.disabled}}}<span class="badge badge-primary">[[admin/manage/admins-mods:disabled]]</span>{{{end}}}</h4>
	<div class="moderator-area" data-cid="{categoryMods.cid}">
		{{{ each categoryMods.moderators }}}
			<div class="user-card pull-left" data-uid="{categoryMods.moderators.uid}">
				{{{ if  categoryMods.moderators.picture }}}
				<img class="avatar avatar-sm" src="{categoryMods.moderators.picture}" />
				{{{ else }}}
				<div class="avatar avatar-sm" style="background-color: {categoryMods.moderators.icon:bgColor};">{categoryMods.moderators.icon:text}</div>
				{{{ end }}}
				<a href="{config.relative_path}/user/{categoryMods.moderators.userslug}">{categoryMods.moderators.username}</a>
				<i class="remove-user-icon fa fa-times" role="button"></i>
			</div>
		{{{ end }}}
	</div>

	<div data-cid="{categoryMods.cid}" class="no-moderator-warning {{{ if categoryMods.moderators.length }}}hidden{{{ end }}}">[[admin/manage/admins-mods:no-moderators]]</div>

	<input data-cid="{categoryMods.cid}" class="form-control moderator-search" placeholder="[[admin/manage/admins-mods:add-moderator]]" />
	</div>
	<br/>
	{{{ end }}}
</div>

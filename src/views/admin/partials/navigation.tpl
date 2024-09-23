<!-- main acp navigation menu -->

<div class="accordion overflow-auto d-flex flex-column gap-1" component="acp/accordion" id="accordionACP">

	<!-- dashboard menu -->
	<div class="d-flex flex-column">
		<button class="btn btn-ghost btn-sm d-flex gap-2 align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseDashboard" aria-expanded="true" aria-controls="collapseDashboard">
			<i class="fa fa-fw fa-gauge"></i>
			<div class="flex-1 font-serif text-sm fw-semibold text-start">[[admin/menu:section-dashboard]]</div>
		</button>

		<div id="collapseDashboard" class="accordion-collapse collapse" data-bs-parent="#accordionACP">
			<div class="accordion-body p-0 d-grid">
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/dashboard">[[admin/menu:dashboard/overview]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/dashboard/logins">[[admin/menu:dashboard/logins]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/dashboard/users">[[admin/menu:dashboard/users]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/dashboard/topics">[[admin/menu:dashboard/topics]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/dashboard/searches">[[admin/menu:dashboard/searches]]</a>
			</div>
		</div>
	</div>

	<!-- manage menu -->
	{{{ if showManageMenu }}}
	<div class="d-flex flex-column">
		<button class="btn btn-ghost btn-sm d-flex gap-2 align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseManage" aria-expanded="true" aria-controls="collapseManage">
			<i class="fa fa-fw fa-list"></i>
			<div class="flex-1 font-serif text-sm fw-semibold text-start">[[admin/menu:section-manage]]</div>
		</button>

		<div id="collapseManage" class="accordion-collapse collapse" data-bs-parent="#accordionACP">
			<div class="accordion-body p-0 d-grid">
				{{{ if user.privileges.admin:categories }}}
				<a class="btn btn-ghost btn-sm text-start" id="manage-categories" href="{relative_path}/admin/manage/categories">[[admin/menu:manage/categories]]</a>
				{{{ end }}}
				{{{ if user.privileges.admin:privileges }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/manage/privileges">[[admin/menu:manage/privileges]]</a>
				{{{ end }}}
				{{{ if user.privileges.admin:users }}}
				<a class="btn btn-ghost btn-sm text-start" id="manage-users" href="{relative_path}/admin/manage/users">[[admin/menu:manage/users]]</a>
				{{{ end }}}
				{{{ if user.privileges.admin:groups }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/manage/groups">[[admin/menu:manage/groups]]</a>
				{{{ end }}}
				{{{ if user.privileges.admin:admins-mods }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/manage/admins-mods">[[admin/menu:manage/admins-mods]]</a>
				{{{ end }}}
				{{{ if user.privileges.admin:tags }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/manage/tags">[[admin/menu:manage/tags]]</a>
				{{{ end }}}
				{{{ if user.privileges.superadmin }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/manage/registration">[[admin/menu:manage/registration]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/manage/uploads">[[admin/menu:manage/uploads]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/manage/digest">[[admin/menu:manage/digest]]</a>
				<hr/>
				<h6 class="text-xs ps-4">[[pages:moderator-tools]]</h6>
				<a class="btn btn-ghost btn-sm text-start" target="_top" href="{relative_path}/flags">[[admin/menu:manage/flagged-content]] <i class="fa fa-external-link"></i></a>
				<a class="btn btn-ghost btn-sm text-start" target="_top" href="{relative_path}/post-queue">[[admin/menu:manage/post-queue]] <i class="fa fa-external-link"></i></a>
				<a class="btn btn-ghost btn-sm text-start" target="_top" href="{relative_path}/ip-blacklist">[[admin/menu:manage/ip-blacklist]] <i class="fa fa-external-link"></i></a>
				{{{ end }}}
			</div>
		</div>
	</div>
	{{{ end }}}

	<!-- settings menu -->
	{{{ if user.privileges.admin:settings }}}
	<div class="d-flex flex-column">
		<button class="btn btn-ghost btn-sm d-flex gap-2 align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSettings" aria-expanded="true" aria-controls="collapseSettings">
			<i class="fa fa-fw fa-sliders"></i>
			<div class="flex-1 font-serif text-sm fw-semibold text-start">[[admin/menu:section-settings]]</div>
		</button>

		<div id="collapseSettings" class="accordion-collapse collapse" data-bs-parent="#accordionACP">
			<div class="accordion-body p-0 d-grid">
				<a class="btn btn-ghost btn-sm text-start" id="settings-general" href="{relative_path}/admin/settings/general">[[admin/menu:section-general]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/navigation">[[admin/menu:settings/navigation]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/user">[[admin/menu:settings/user]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/reputation">[[admin/menu:settings/reputation]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/group">[[admin/menu:settings/group]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/tags">[[admin/menu:manage/tags]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/post">[[admin/menu:settings/post]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/uploads">[[admin/menu:settings/uploads]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/email">[[admin/menu:settings/email]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/chat">[[admin/menu:settings/chat]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/pagination">[[admin/menu:settings/pagination]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/notifications">[[admin/menu:settings/notifications]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/api">[[admin/menu:settings/api]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/activitypub">[[admin/menu:settings/activitypub]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/cookies">[[admin/menu:settings/cookies]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/web-crawler">[[admin/menu:settings/web-crawler]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/advanced">[[admin/menu:settings/advanced]]</a>
			</div>
		</div>
	</div>


	<!-- appearance menu -->
	<div class="d-flex flex-column">
		<button class="btn btn-ghost btn-sm d-flex gap-2 align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseAppearance" aria-expanded="true" aria-controls="collapseAppearance">
			<i class="fa fa-fw fa-paintbrush"></i>
			<div class="flex-1 font-serif text-sm fw-semibold text-start">[[admin/menu:section-appearance]]</div>
		</button>

		<div id="collapseAppearance" class="accordion-collapse collapse" data-bs-parent="#accordionACP">
			<div class="accordion-body p-0 d-grid">
				<a class="btn btn-ghost btn-sm text-start" id="appearance-themes" href="{relative_path}/admin/appearance/themes">[[admin/menu:appearance/themes]]</a>
				<a class="btn btn-ghost btn-sm text-start" id="appearance-skins" href="{relative_path}/admin/appearance/skins">[[admin/menu:appearance/skins]]</a>
				<a class="btn btn-ghost btn-sm text-start" id="appearance-customise" href="{relative_path}/admin/appearance/customise">[[admin/menu:appearance/customise]]</a>
			</div>
		</div>
	</div>


	<!-- extend menu -->
	<div class="d-flex flex-column">
		<button class="btn btn-ghost btn-sm d-flex gap-2 align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseExtend" aria-expanded="true" aria-controls="collapseExtend">
			<i class="fa fa-fw fa-wrench"></i>
			<div class="flex-1 font-serif text-sm fw-semibold text-start">[[admin/menu:section-extend]]</div>
		</button>

		<div id="collapseExtend" class="accordion-collapse collapse" data-bs-parent="#accordionACP">
			<div class="accordion-body p-0 d-grid">
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/extend/plugins">[[admin/menu:extend/plugins]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/extend/widgets">[[admin/menu:extend/widgets]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/extend/rewards">[[admin/menu:extend/rewards]]</a>
			</div>
		</div>
	</div>

	<!-- plugins menu -->
	{{{ if plugins.length }}}
	<div class="d-flex flex-column">
		<button class="btn btn-ghost btn-sm d-flex gap-2 align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapsePlugins" aria-expanded="true" aria-controls="collapsePlugins">
			<i class="fa fa-fw fa-plug"></i>
			<div class="flex-1 font-serif text-sm fw-semibold text-start">[[admin/menu:section-plugins]]</div>
		</button>

		<div id="collapsePlugins" class="accordion-collapse collapse" data-bs-parent="#accordionACP">
			<div class="accordion-body p-0 d-grid">
				{{{ each plugins }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin{./route}">{./name}</a>
				{{{ end }}}

				{{{ if authentication.length }}}
				<hr/>
				<div class="text-sm ms-4">[[admin/menu:section-social-auth]]</div>
				{{{ each authentication }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin{./route}">{./name}</a>
				{{{ end }}}
				{{{ end }}}
				<hr/>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/extend/plugins#download">[[admin/menu:extend/plugins.install]]</a>
			</div>
		</div>
	</div>
	{{{ end }}}
	{{{ end }}}

	<!-- advanced menu -->
	{{{ if user.privileges.superadmin }}}
	<div class="d-flex flex-column">
		<button class="btn btn-ghost btn-sm d-flex gap-2 align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseAdvanced" aria-expanded="true" aria-controls="collapseAdvanced">
			<i class="fa fa-fw fa-superpowers"></i>
			<div class="flex-1 font-serif text-sm fw-semibold text-start">[[admin/menu:section-advanced]]</div>
		</button>

		<div id="collapseAdvanced" class="accordion-collapse collapse" data-bs-parent="#accordionACP">
			<div class="accordion-body p-0 d-grid">
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/advanced/database">[[admin/menu:advanced/database]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/advanced/events">[[admin/menu:advanced/events]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/advanced/hooks">[[admin/menu:advanced/hooks]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/advanced/cache">[[admin/menu:advanced/cache]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/advanced/errors">[[admin/menu:advanced/errors]]</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/advanced/logs">[[admin/menu:advanced/logs]]</a>
				{{{ if env }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/development/logger">[[admin/menu:development/logger]]</a>
				{{{ end }}}
			</div>
		</div>
	</div>
	{{{ end }}}
  </div>
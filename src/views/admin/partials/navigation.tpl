<!-- main acp navigation menu -->

<div class="accordion overflow-auto d-flex flex-column gap-1" component="acp/accordion" id="accordionACP">

	<!-- dashboard menu -->
	<div class="d-flex flex-column">
		<button class="btn btn-ghost btn-sm d-flex gap-2 align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseDashboard" aria-expanded="true" aria-controls="collapseDashboard">
			<i class="fa fa-fw fa-gauge"></i>
			<div class="flex-1 font-serif text-sm fw-semibold text-start">{{tx("admin/menu:section-dashboard")}}</div>
		</button>

		<div id="collapseDashboard" class="accordion-collapse collapse" data-bs-parent="#accordionACP">
			<div class="accordion-body p-0 d-grid">
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/dashboard">{{tx("admin/menu:dashboard/overview")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/dashboard/logins">{{tx("admin/menu:dashboard/logins")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/dashboard/users">{{tx("admin/menu:dashboard/users")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/dashboard/topics">{{tx("admin/menu:dashboard/topics")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/dashboard/searches">{{tx("admin/menu:dashboard/searches")}}</a>
			</div>
		</div>
	</div>

	<!-- manage menu -->
	{{{ if showManageMenu }}}
	<div class="d-flex flex-column">
		<button class="btn btn-ghost btn-sm d-flex gap-2 align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseManage" aria-expanded="true" aria-controls="collapseManage">
			<i class="fa fa-fw fa-list"></i>
			<div class="flex-1 font-serif text-sm fw-semibold text-start">{{tx("admin/menu:section-manage")}}</div>
		</button>

		<div id="collapseManage" class="accordion-collapse collapse" data-bs-parent="#accordionACP">
			<div class="accordion-body p-0 d-grid">
				{{{ if user.privileges.admin:categories }}}
				<a class="btn btn-ghost btn-sm text-start" id="manage-categories" href="{relative_path}/admin/manage/categories">{{tx("admin/menu:manage/categories")}}</a>
				{{{ end }}}
				{{{ if user.privileges.admin:privileges }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/manage/privileges">{{tx("admin/menu:manage/privileges")}}</a>
				{{{ end }}}
				{{{ if user.privileges.admin:users }}}
				<a class="btn btn-ghost btn-sm text-start" id="manage-users" href="{relative_path}/admin/manage/users">{{tx("admin/menu:manage/users")}}</a>
				{{{ end }}}
				{{{ if user.privileges.admin:groups }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/manage/groups">{{tx("admin/menu:manage/groups")}}</a>
				{{{ end }}}
				{{{ if user.privileges.admin:admins-mods }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/manage/admins-mods">{{tx("admin/menu:manage/admins-mods")}}</a>
				{{{ end }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/manage/api">{{tx("admin/menu:settings/api")}}</a>
				{{{ if user.privileges.admin:tags }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/manage/tags">{{tx("admin/menu:manage/tags")}}</a>
				{{{ end }}}
				{{{ if user.privileges.superadmin }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/manage/uploads">{{tx("admin/menu:manage/uploads")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/manage/digest">{{tx("admin/menu:manage/digest")}}</a>
				<hr/>
				<h6 class="text-xs ps-4">{{tx("pages:moderator-tools")}}</h6>
				<a class="btn btn-ghost btn-sm text-start" target="_top" href="{relative_path}/flags">{{tx("admin/menu:manage/flagged-content")}} <i class="fa fa-external-link"></i></a>
				<a class="btn btn-ghost btn-sm text-start" target="_top" href="{relative_path}/post-queue">{{tx("admin/menu:manage/post-queue")}} <i class="fa fa-external-link"></i></a>
				<a class="btn btn-ghost btn-sm text-start" target="_top" href="{relative_path}/registration-queue">{{tx("admin/menu:manage/registration")}} <i class="fa fa-external-link"></i></a>
				<a class="btn btn-ghost btn-sm text-start" target="_top" href="{relative_path}/ip-blacklist">{{tx("admin/menu:manage/ip-blacklist")}} <i class="fa fa-external-link"></i></a>
				{{{ end }}}
			</div>
		</div>
	</div>
	{{{ end }}}

	{{{ if user.privileges.admin:settings }}}
	<!-- settings menu -->
	<div class="d-flex flex-column">
		<button class="btn btn-ghost btn-sm d-flex gap-2 align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSettings" aria-expanded="true" aria-controls="collapseSettings">
			<i class="fa fa-fw fa-sliders"></i>
			<div class="flex-1 font-serif text-sm fw-semibold text-start">{{tx("admin/menu:section-settings")}}</div>
		</button>

		<div id="collapseSettings" class="accordion-collapse collapse" data-bs-parent="#accordionACP">
			<div class="accordion-body p-0 d-grid">
				<a class="btn btn-ghost btn-sm text-start" id="settings-general" href="{relative_path}/admin/settings/general">{{tx("admin/menu:section-general")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/navigation">{{tx("admin/menu:settings/navigation")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/user">{{tx("admin/menu:settings/user")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/reputation">{{tx("admin/menu:settings/reputation")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/group">{{tx("admin/menu:settings/group")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/tags">{{tx("admin/menu:manage/tags")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/post">{{tx("admin/menu:settings/post")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/uploads">{{tx("admin/menu:settings/uploads")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/email">{{tx("admin/menu:settings/email")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/chat">{{tx("admin/menu:settings/chat")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/pagination">{{tx("admin/menu:settings/pagination")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/notifications">{{tx("admin/menu:settings/notifications")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/cookies">{{tx("admin/menu:settings/cookies")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/web-crawler">{{tx("admin/menu:settings/web-crawler")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/settings/advanced">{{tx("admin/menu:settings/advanced")}}</a>
			</div>
		</div>
	</div>


	<!-- federation menu -->
	<div class="d-flex flex-column">
		<button class="btn btn-ghost btn-sm d-flex gap-2 align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseFederation" aria-expanded="true" aria-controls="collapseFederation">
			<i class="fa fa-fw fa-circle-nodes"></i>
			<div class="flex-1 font-serif text-sm fw-semibold text-start">{{tx("admin/menu:section-federation")}}</div>
		</button>

		<div id="collapseFederation" class="accordion-collapse collapse" data-bs-parent="#accordionACP">
			<div class="accordion-body p-0 d-grid">
				<a class="btn btn-ghost btn-sm text-start" id="federation-general" href="{relative_path}/admin/federation/general">{{tx("admin/menu:federation/general")}}</a>
				<a class="btn btn-ghost btn-sm text-start" id="federation-content" href="{relative_path}/admin/federation/content">{{tx("admin/menu:federation/content")}}</a>
				<a class="btn btn-ghost btn-sm text-start" id="federation-rules" href="{relative_path}/admin/federation/rules">{{tx("admin/menu:federation/rules")}}</a>
				<a class="btn btn-ghost btn-sm text-start" id="federation-relays" href="{relative_path}/admin/federation/relays">{{tx("admin/menu:federation/relays")}}</a>
				<a class="btn btn-ghost btn-sm text-start" id="federation-pruning" href="{relative_path}/admin/federation/pruning">{{tx("admin/menu:federation/pruning")}}</a>
				<a class="btn btn-ghost btn-sm text-start" id="federation-safety" href="{relative_path}/admin/federation/safety">{{tx("admin/menu:federation/safety")}}</a>
				<a class="btn btn-ghost btn-sm text-start" id="federation-analytics" href="{relative_path}/admin/federation/analytics">{{tx("admin/menu:federation/analytics")}}</a>
				<a class="btn btn-ghost btn-sm text-start" id="federation-errors" href="{relative_path}/admin/federation/errors">{{tx("admin/menu:federation/errors")}}</a>
			</div>
		</div>
	</div>


	<!-- appearance menu -->
	<div class="d-flex flex-column">
		<button class="btn btn-ghost btn-sm d-flex gap-2 align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseAppearance" aria-expanded="true" aria-controls="collapseAppearance">
			<i class="fa fa-fw fa-paintbrush"></i>
			<div class="flex-1 font-serif text-sm fw-semibold text-start">{{tx("admin/menu:section-appearance")}}</div>
		</button>

		<div id="collapseAppearance" class="accordion-collapse collapse" data-bs-parent="#accordionACP">
			<div class="accordion-body p-0 d-grid">
				<a class="btn btn-ghost btn-sm text-start" id="appearance-themes" href="{relative_path}/admin/appearance/themes">{{tx("admin/menu:appearance/themes")}}</a>
				<a class="btn btn-ghost btn-sm text-start" id="appearance-skins" href="{relative_path}/admin/appearance/skins">{{tx("admin/menu:appearance/skins")}}</a>
				<a class="btn btn-ghost btn-sm text-start" id="appearance-customise" href="{relative_path}/admin/appearance/customise">{{tx("admin/menu:appearance/customise")}}</a>
			</div>
		</div>
	</div>


	<!-- extend menu -->
	<div class="d-flex flex-column">
		<button class="btn btn-ghost btn-sm d-flex gap-2 align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseExtend" aria-expanded="true" aria-controls="collapseExtend">
			<i class="fa fa-fw fa-wrench"></i>
			<div class="flex-1 font-serif text-sm fw-semibold text-start">{{tx("admin/menu:section-extend")}}</div>
		</button>

		<div id="collapseExtend" class="accordion-collapse collapse" data-bs-parent="#accordionACP">
			<div class="accordion-body p-0 d-grid">
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/extend/plugins">{{tx("admin/menu:extend/plugins")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/extend/widgets">{{tx("admin/menu:extend/widgets")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/extend/rewards">{{tx("admin/menu:extend/rewards")}}</a>
			</div>
		</div>
	</div>

	<!-- plugins menu -->
	{{{ if plugins.length }}}
	<div class="d-flex flex-column">
		<button class="btn btn-ghost btn-sm d-flex gap-2 align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapsePlugins" aria-expanded="true" aria-controls="collapsePlugins">
			<i class="fa fa-fw fa-plug"></i>
			<div class="flex-1 font-serif text-sm fw-semibold text-start">{{tx("admin/menu:section-plugins")}}</div>
		</button>

		<div id="collapsePlugins" class="accordion-collapse collapse" data-bs-parent="#accordionACP">
			<div class="accordion-body p-0 d-grid">
				{{{ each plugins }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin{./route}">{{tx(./name)}}</a>
				{{{ end }}}

				{{{ if authentication.length }}}
				<hr/>
				<div class="text-sm ms-4">{{tx("admin/menu:section-social-auth")}}</div>
				{{{ each authentication }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin{./route}">{{tx(./name)}}</a>
				{{{ end }}}
				{{{ end }}}
				<hr/>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/extend/plugins#download">{{tx("admin/menu:extend/plugins.install")}}</a>
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
			<div class="flex-1 font-serif text-sm fw-semibold text-start">{{tx("admin/menu:section-advanced")}}</div>
		</button>

		<div id="collapseAdvanced" class="accordion-collapse collapse" data-bs-parent="#accordionACP">
			<div class="accordion-body p-0 d-grid">
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/advanced/database">{{tx("admin/menu:advanced/database")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/advanced/events">{{tx("admin/menu:advanced/events")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/advanced/hooks">{{tx("admin/menu:advanced/hooks")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/advanced/cache">{{tx("admin/menu:advanced/cache")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/advanced/jobs">{{tx("admin/menu:advanced/jobs")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/advanced/errors">{{tx("admin/menu:advanced/errors")}}</a>
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/advanced/logs">{{tx("admin/menu:advanced/logs")}}</a>
				{{{ if env }}}
				<a class="btn btn-ghost btn-sm text-start" href="{relative_path}/admin/development/logger">{{tx("admin/menu:development/logger")}}</a>
				{{{ end }}}
			</div>
		</div>
	</div>
	{{{ end }}}
  </div>
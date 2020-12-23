<nav id="menu" class="hidden-md hidden-lg">
	<section class="menu-section quick-actions">
		<ul class="menu-section-list">
			{{{ if user.privileges.superadmin }}}
			<div class="button-group">
				<!-- IMPORT admin/partials/quick_actions/buttons.tpl -->
			</div>
			{{{ end }}}

			<!-- IMPORT admin/partials/quick_actions/alerts.tpl -->
		</ul>
	</section>

	{{{ if showManageMenu }}}
	<section class="menu-section">
		<h3 class="menu-section-title">[[admin/menu:section-manage]]</h3>
		<ul class="menu-section-list">
			{{{ if user.privileges.admin:categories }}}<li><a href="{relative_path}/admin/manage/categories">[[admin/menu:manage/categories]]</a></li>{{{ end }}}
			{{{ if user.privileges.admin:privileges }}}<li><a href="{relative_path}/admin/manage/privileges">[[admin/menu:manage/privileges]]</a></li>{{{ end }}}
			{{{ if user.privileges.admin:users }}}<li><a href="{relative_path}/admin/manage/users">[[admin/menu:manage/users]]</a></li>{{{ end }}}
			{{{ if user.privileges.admin:groups }}}<li><a href="{relative_path}/admin/manage/groups">[[admin/menu:manage/groups]]</a></li>{{{ end }}}
			{{{ if user.privileges.admin:admins-mods }}}<li><a href="{relative_path}/admin/manage/admins-mods">[[admin/menu:manage/admins-mods]]</a></li>{{{ end }}}
			{{{ if user.privileges.superadmin }}}
			<li><a href="{relative_path}/admin/manage/registration">[[admin/menu:manage/registration]]</a></li>
			<li><a href="{relative_path}/admin/manage/tags">[[admin/menu:manage/tags]]</a></li>
			<li><a href="{relative_path}/admin/manage/uploads">[[admin/menu:manage/uploads]]</a></li>
			<li><a href="{relative_path}/admin/manage/digest">[[admin/menu:manage/digest]]</a></li>

			<li><a target="_top" href="{relative_path}/post-queue">[[admin/menu:manage/post-queue]] <i class="fa fa-external-link"></i></a></li>
			<li><a target="_top" href="{relative_path}/ip-blacklist">[[admin/menu:manage/ip-blacklist]] <i class="fa fa-external-link"></i></a></li>
			{{{ end }}}
		</ul>
	</section>
	{{{ end }}}

	{{{ if user.privileges.admin:settings }}}
	<section class="menu-section">
		<h3 class="menu-section-title">[[admin/menu:section-settings]]</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/settings/general">[[admin/menu:section-general]]</a></li>
			<li><a href="{relative_path}/admin/settings/homepage">[[admin/menu:settings/homepage]]</a></li>
			<li><a href="{relative_path}/admin/settings/navigation">[[admin/menu:settings/navigation]]</a></li>
			<li><a href="{relative_path}/admin/settings/user">[[admin/menu:settings/user]]</a></li>
			<li><a href="{relative_path}/admin/settings/reputation">[[admin/menu:settings/reputation]]</a></li>
			<li><a href="{relative_path}/admin/settings/guest">[[admin/menu:settings/guest]]</a></li>
			<li><a href="{relative_path}/admin/settings/group">[[admin/menu:settings/group]]</a></li>
			<li><a href="{relative_path}/admin/settings/tags">[[admin/menu:manage/tags]]</a></li>
			<li><a href="{relative_path}/admin/settings/post">[[admin/menu:settings/post]]</a></li>
			<li><a href="{relative_path}/admin/settings/uploads">[[admin/menu:settings/uploads]]</a></li>
			<li><a href="{relative_path}/admin/settings/languages">[[admin/menu:settings/languages]]</a></li>
			<li><a href="{relative_path}/admin/settings/email">[[admin/menu:settings/email]]</a></li>
			<li><a href="{relative_path}/admin/settings/chat">[[admin/menu:settings/chat]]</a></li>
			<li><a href="{relative_path}/admin/settings/pagination">[[admin/menu:settings/pagination]]</a></li>
			<li><a href="{relative_path}/admin/settings/notifications">[[admin/menu:settings/notifications]]</a></li>
			<li><a href="{relative_path}/admin/settings/api">[[admin/menu:settings/api]]</a></li>
			<li><a href="{relative_path}/admin/settings/social">[[admin/menu:settings/social]]</a></li>
			<li><a href="{relative_path}/admin/settings/cookies">[[admin/menu:settings/cookies]]</a></li>
			<li><a href="{relative_path}/admin/settings/web-crawler">[[admin/menu:settings/web-crawler]]</a></li>
			<li><a href="{relative_path}/admin/settings/advanced">[[admin/menu:settings/advanced]]</a></li>
		</ul>
	</section>
	<section class="menu-section">
		<h3 class="menu-section-title">[[admin/menu:section-appearance]]</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/appearance/themes">[[admin/menu:appearance/themes]]</a></li>
			<li><a href="{relative_path}/admin/appearance/skins">[[admin/menu:appearance/skins]]</a></li>
			<li><a href="{relative_path}/admin/appearance/customise">[[admin/menu:appearance/customise]]</a></li>
		</ul>
	</section>

	<section class="menu-section">
		<h3 class="menu-section-title">[[admin/menu:section-extend]]</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/extend/plugins">[[admin/menu:extend/plugins]]</a></li>
			<li><a href="{relative_path}/admin/extend/widgets">[[admin/menu:extend/widgets]]</a></li>
			<li><a href="{relative_path}/admin/extend/rewards">[[admin/menu:extend/rewards]]</a></li>
		</ul>
	</section>

	<!-- IF plugins.length -->
	<section class="menu-section">
		<h3 class="menu-section-title">[[admin/menu:section-plugins]]</h3>
		<ul class="menu-section-list">
			<!-- BEGIN plugins -->
			<li>
				<a href="{relative_path}/admin{plugins.route}">{plugins.name}</a>
			</li>
			<!-- END plugins -->
		</ul>
	</section>
	<!-- ENDIF plugins.length -->

	<!-- IF authentication.length -->
	<section class="menu-section">
		<h3 class="menu-section-title">[[admin/menu:section-social-auth]]</h3>
		<ul class="menu-section-list">
			<!-- BEGIN authentication -->
			<li>
				<a href="{relative_path}/admin{authentication.route}">{authentication.name}</a>
			</li>
			<!-- END authentication -->
		</ul>
	</section>
	<!-- ENDIF authentication.length -->
	{{{ end }}}

	{{{ if user.privileges.superadmin }}}
	<section class="menu-section">
		<h3 class="menu-section-title">[[admin/menu:section-advanced]]</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/advanced/database">[[admin/menu:advanced/database]]</a></li>
			<li><a href="{relative_path}/admin/advanced/events">[[admin/menu:advanced/events]]</a></li>
			<li><a href="{relative_path}/admin/advanced/hooks">[[admin/menu:advanced/hooks]]</a></li>
			<li><a href="{relative_path}/admin/advanced/cache">[[admin/menu:advanced/cache]]</a></li>
			<li><a href="{relative_path}/admin/advanced/errors">[[admin/menu:advanced/errors]]</a></li>
			<li><a href="{relative_path}/admin/advanced/logs">[[admin/menu:advanced/logs]]</a></li>
			<!-- IF env -->
			<li><a href="{relative_path}/admin/development/logger">[[admin/menu:development/logger]]</a></li>
			<!-- ENDIF env -->
		</ul>
	</section>
	{{{ end }}}
</nav>

<main id="panel">
	<nav class="header" id="header">
		<div class="pull-left">
			<div id="mobile-menu">
				<div class="bar"></div>
				<div class="bar"></div>
				<div class="bar"></div>
			</div>
			<h1 id="main-page-title"></h1>
		</div>

		<ul class="quick-actions hidden-xs hidden-sm">
			<!-- IMPORT admin/partials/quick_actions/buttons.tpl -->

			{{{ if user.privileges.admin:settings }}}
			<form role="search">
				<div id="acp-search" >
					<div class="dropdown">
						<input type="text" data-toggle="dropdown" class="form-control" placeholder="[[admin/menu:search.placeholder]]">
						<ul class="dropdown-menu dropdown-menu-right state-start-typing" role="menu">
							<li role="presentation" class="no-results">
								<a>[[admin/menu:search.no-results]]</a>
							</li>
							<li role="presentation" class="divider search-forum"></li>
							<li role="presentation" class="search-forum">
								<a role="menuitem" target="_top" href="#">
									[[admin/menu:search.search-forum]]
								</a>
							</li>
							<li role="presentation" class="keep-typing">
								<a>[[admin/menu:search.keep-typing]]</a>
							</li>
							<li role="presentation" class="start-typing">
								<a>[[admin/menu:search.start-typing]]</a>
							</li>
						</ul>
					</div>
				</div>
			</form>
			{{{ end }}}

			{{{ if user.privileges.superadmin }}}
			<!-- IMPORT admin/partials/quick_actions/alerts.tpl -->
			{{{ end }}}

			<li class="reconnect-spinner">
				<a href="#" id="reconnect" class="hide" title="[[admin/menu:connection-lost, {title}]]">
					<i class="fa fa-check"></i>
				</a>
			</li>
		</ul>


		<ul id="main-menu">
			{{{ if user.privileges.admin:dashboard }}}
			<li class="menu-item">
				<a href="{relative_path}/admin/dashboard">[[admin/menu:dashboard]]</a>
			</li>
			{{{ end }}}

			{{{ if showManageMenu }}}
			<li class="dropdown menu-item">
				<a id="manage-menu" href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin/menu:section-manage]]</a>
				<ul class="dropdown-menu" role="menu">
					{{{ if user.privileges.admin:categories }}}<li><a id="manage-categories" href="{relative_path}/admin/manage/categories">[[admin/menu:manage/categories]]</a></li>{{{ end }}}
					{{{ if user.privileges.admin:privileges }}}<li><a href="{relative_path}/admin/manage/privileges">[[admin/menu:manage/privileges]]</a></li>{{{ end }}}
					{{{ if user.privileges.admin:users }}}<li><a id="manage-users" href="{relative_path}/admin/manage/users">[[admin/menu:manage/users]]</a></li>{{{ end }}}
					{{{ if user.privileges.admin:groups }}}<li><a href="{relative_path}/admin/manage/groups">[[admin/menu:manage/groups]]</a></li>{{{ end }}}
					{{{ if user.privileges.admin:admins-mods }}}<li><a href="{relative_path}/admin/manage/admins-mods">[[admin/menu:manage/admins-mods]]</a></li>{{{ end }}}
					{{{ if user.privileges.superadmin }}}
					<li><a href="{relative_path}/admin/manage/registration">[[admin/menu:manage/registration]]</a></li>
					<li><a href="{relative_path}/admin/manage/tags">[[admin/menu:manage/tags]]</a></li>
					<li><a href="{relative_path}/admin/manage/uploads">[[admin/menu:manage/uploads]]</a></li>
					<li><a href="{relative_path}/admin/manage/digest">[[admin/menu:manage/digest]]</a></li>
					<li role="separator" class="divider"></li>
					<li><a target="_top" href="{relative_path}/post-queue">[[admin/menu:manage/post-queue]] <i class="fa fa-external-link"></i></a></li>
					<li><a target="_top" href="{relative_path}/ip-blacklist">[[admin/menu:manage/ip-blacklist]] <i class="fa fa-external-link"></i></a></li>
					{{{ end }}}
				</ul>
			</li>
			{{{ end }}}

			{{{ if user.privileges.admin:settings }}}
			<li class="dropdown menu-item">
				<a id="settings-menu" href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin/menu:section-settings]]</a>
				<ul class="dropdown-menu" role="menu">
					<li><a id="settings-general" href="{relative_path}/admin/settings/general">[[admin/menu:section-general]]</a></li>
					<li><a href="{relative_path}/admin/settings/homepage">[[admin/menu:settings/homepage]]</a></li>
					<li><a href="{relative_path}/admin/settings/navigation">[[admin/menu:settings/navigation]]</a></li>
					<li><a href="{relative_path}/admin/settings/user">[[admin/menu:settings/user]]</a></li>
					<li><a href="{relative_path}/admin/settings/reputation">[[admin/menu:settings/reputation]]</a></li>
					<li><a href="{relative_path}/admin/settings/guest">[[admin/menu:settings/guest]]</a></li>
					<li><a href="{relative_path}/admin/settings/group">[[admin/menu:settings/group]]</a></li>
					<li><a href="{relative_path}/admin/settings/tags">[[admin/menu:manage/tags]]</a></li>
					<li><a href="{relative_path}/admin/settings/post">[[admin/menu:settings/post]]</a></li>
					<li><a href="{relative_path}/admin/settings/uploads">[[admin/menu:settings/uploads]]</a></li>
					<li><a href="{relative_path}/admin/settings/languages">[[admin/menu:settings/languages]]</a></li>
					<li><a href="{relative_path}/admin/settings/email">[[admin/menu:settings/email]]</a></li>
					<li><a href="{relative_path}/admin/settings/chat">[[admin/menu:settings/chat]]</a></li>
					<li><a href="{relative_path}/admin/settings/pagination">[[admin/menu:settings/pagination]]</a></li>
					<li><a href="{relative_path}/admin/settings/notifications">[[admin/menu:settings/notifications]]</a></li>
					<li><a href="{relative_path}/admin/settings/api">[[admin/menu:settings/api]]</a></li>
					<li><a href="{relative_path}/admin/settings/social">[[admin/menu:settings/social]]</a></li>
					<li><a href="{relative_path}/admin/settings/cookies">[[admin/menu:settings/cookies]]</a></li>
					<li><a href="{relative_path}/admin/settings/web-crawler">[[admin/menu:settings/web-crawler]]</a></li>
					<li><a href="{relative_path}/admin/settings/advanced">[[admin/menu:settings/advanced]]</a></li>
				</ul>
			</li>
			<li class="dropdown menu-item">
				<a id="appearance-menu" href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin/menu:section-appearance]]</a>
				<ul class="dropdown-menu" role="menu">
					<li><a id="appearance-themes" href="{relative_path}/admin/appearance/themes">[[admin/menu:appearance/themes]]</a></li>
					<li><a id="appearance-skins" href="{relative_path}/admin/appearance/skins">[[admin/menu:appearance/skins]]</a></li>
					<li><a id="appearance-customise" href="{relative_path}/admin/appearance/customise">[[admin/menu:appearance/customise]]</a></li>
				</ul>
			</li>
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin/menu:section-extend]]</a>
				<ul class="dropdown-menu" role="menu">
					<li><a href="{relative_path}/admin/extend/plugins">[[admin/menu:extend/plugins]]</a></li>
					<li><a href="{relative_path}/admin/extend/widgets">[[admin/menu:extend/widgets]]</a></li>
					<li><a href="{relative_path}/admin/extend/rewards">[[admin/menu:extend/rewards]]</a></li>
				</ul>
			</li>
			<!-- IF plugins.length -->
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin/menu:section-plugins]]</a>
				<ul class="dropdown-menu plugins-menu" role="menu">
					<li class="dropdown-header">[[admin/menu:section-plugins]]</li>
					<!-- BEGIN plugins -->
					<li>
						<a href="{relative_path}/admin{plugins.route}">{plugins.name}</a>
					</li>
					<!-- END plugins -->
					<!-- IF authentication.length -->
					<li class="divider"></li>
					{{{if authentication.length}}}
					<li class="dropdown-header">[[admin/menu:section-social-auth]]</li>
					{{{each authentication}}}
					<li>
						<a href="{relative_path}/admin{authentication.route}">{authentication.name}</a>
					</li>
					{{{end}}}
					{{{end}}}
					<!-- ENDIF authentication.length -->
					<li class="divider"></li>
					<li data-link="1">
						<a href="{relative_path}/admin/extend/plugins#download">[[admin/menu:extend/plugins.install]]</a>
					</li>
				</ul>
			</li>
			<!-- ENDIF plugins.length -->
			{{{ end }}}

			{{{ if user.privileges.superadmin }}}
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin/menu:section-advanced]]</a>
				<ul class="dropdown-menu" role="menu">
					<li><a href="{relative_path}/admin/advanced/database">[[admin/menu:advanced/database]]</a></li>
					<li><a href="{relative_path}/admin/advanced/events">[[admin/menu:advanced/events]]</a></li>
					<li><a href="{relative_path}/admin/advanced/hooks">[[admin/menu:advanced/hooks]]</a></li>
					<li><a href="{relative_path}/admin/advanced/cache">[[admin/menu:advanced/cache]]</a></li>
					<li><a href="{relative_path}/admin/advanced/errors">[[admin/menu:advanced/errors]]</a></li>
					<li><a href="{relative_path}/admin/advanced/logs">[[admin/menu:advanced/logs]]</a></li>
					<!-- IF env -->
					<li><a href="{relative_path}/admin/development/logger">[[admin/menu:development/logger]]</a></li>
					<!-- ENDIF env -->
				</ul>
			</li>
			{{{ end }}}
		</ul>
	</nav>
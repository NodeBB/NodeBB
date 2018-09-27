<nav id="menu" class="hidden-md hidden-lg">
	<section class="menu-section quick-actions">
		<ul class="menu-section-list">
			<div class="button-group">
				<!-- IMPORT admin/partials/quick_actions/buttons.tpl -->
			</div>

			<!-- IMPORT admin/partials/quick_actions/alerts.tpl -->
		</ul>
	</section>
	
	<section class="menu-section">
		<h3 class="menu-section-title">[[admin/menu:section-general]]</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/general/dashboard">[[admin/menu:general/dashboard]]</a></li>
			<li><a href="{relative_path}/admin/general/homepage">[[admin/menu:general/homepage]]</a></li>
			<li><a href="{relative_path}/admin/general/navigation">[[admin/menu:general/navigation]]</a></li>
			<li><a href="{relative_path}/admin/general/languages">[[admin/menu:general/languages]]</a></li>
			<li><a href="{relative_path}/admin/general/sounds">[[admin/menu:general/sounds]]</a></li>
			<li><a href="{relative_path}/admin/general/social">[[admin/menu:general/social]]</a></li>
		</ul>
	</section>

	<section class="menu-section">
		<h3 class="menu-section-title">[[admin/menu:section-manage]]</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/manage/categories">[[admin/menu:manage/categories]]</a></li>
			<li><a href="{relative_path}/admin/manage/privileges">[[admin/menu:manage/privileges]]</a></li>
			<li><a href="{relative_path}/admin/manage/users">[[admin/menu:manage/users]]</a></li>
			<li><a href="{relative_path}/admin/manage/admins-mods">[[admin/menu:manage/admins-mods]]</a></li>
			<li><a href="{relative_path}/admin/manage/groups">[[admin/menu:manage/groups]]</a></li>
			<li><a href="{relative_path}/admin/manage/tags">[[admin/menu:manage/tags]]</a></li>
			<li><a href="{relative_path}/admin/manage/registration">[[admin/menu:manage/registration]]</a></li>
			<li><a href="{relative_path}/admin/manage/post-queue">[[admin/menu:manage/post-queue]]</a></li>
			<li><a href="{relative_path}/admin/manage/ip-blacklist">[[admin/menu:manage/ip-blacklist]]</a></li>
			<li><a href="{relative_path}/admin/manage/uploads">[[admin/menu:manage/uploads]]</a></li>
		</ul>
	</section>

	<section class="menu-section">
		<h3 class="menu-section-title">[[admin/menu:section-settings]]</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/settings/general">[[admin/menu:section-general]]</a></li>
			<li><a href="{relative_path}/admin/settings/user">[[admin/menu:settings/user]]</a></li>
			<li><a href="{relative_path}/admin/settings/group">[[admin/menu:settings/group]]</a></li>
			<li><a href="{relative_path}/admin/settings/tags">[[admin/menu:manage/tags]]</a></li>
			<li><a href="{relative_path}/admin/settings/post">[[admin/menu:settings/post]]</a></li>
			<li><a href="{relative_path}/admin/settings/email">[[admin/menu:settings/email]]</a></li>
			<li><a href="{relative_path}/admin/settings/reputation">[[admin/menu:settings/reputation]]</a></li>
			<li><a href="{relative_path}/admin/settings/guest">[[admin/menu:settings/guest]]</a></li>
			<li><a href="{relative_path}/admin/settings/uploads">[[admin/menu:settings/uploads]]</a></li>
			<li><a href="{relative_path}/admin/settings/chat">[[admin/menu:settings/chat]]</a></li>
			<li><a href="{relative_path}/admin/settings/pagination">[[admin/menu:settings/pagination]]</a></li>
			<li><a href="{relative_path}/admin/settings/notifications">[[admin/menu:settings/notifications]]</a></li>
			<li><a href="{relative_path}/admin/settings/cookies">[[admin/menu:settings/cookies]]</a></li>
			<li><a href="{relative_path}/admin/settings/web-crawler">[[admin/menu:settings/web-crawler]]</a></li>
			<li><a href="{relative_path}/admin/settings/sockets">[[admin/menu:settings/sockets]]</a></li>
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

	<section class="menu-section">
		<h3 class="menu-section-title">[[admin/menu:section-advanced]]</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/advanced/database">[[admin/menu:advanced/database]]</a></li>
			<li><a href="{relative_path}/admin/advanced/events">[[admin/menu:advanced/events]]</a></li>
			<li><a href="{relative_path}/admin/advanced/cache">[[admin/menu:advanced/cache]]</a></li>
			<li><a href="{relative_path}/admin/advanced/errors">[[admin/menu:advanced/errors]]</a></li>
			<li><a href="{relative_path}/admin/advanced/logs">[[admin/menu:advanced/logs]]</a></li>
			<!-- IF env -->
			<li><a href="{relative_path}/admin/development/logger">[[admin/menu:development/logger]]</a></li>
			<!-- ENDIF env -->
		</ul>
	</section>
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
			
			<form role="search">
				<div id="acp-search" >
					<div class="dropdown">
						<input type="text" autofocus data-toggle="dropdown" class="form-control" placeholder="[[admin/menu:search.placeholder]]">
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

			<!-- IMPORT admin/partials/quick_actions/alerts.tpl -->

			<li class="reconnect-spinner">
				<a href="#" id="reconnect" class="hide" title="[[admin/menu:connection-lost, {title}]]">
					<i class="fa fa-check"></i>
				</a>
			</li>
		</ul>


		<ul id="main-menu">
			<li class="menu-item">
				<a href="{relative_path}/admin/general/dashboard">[[admin/menu:general/dashboard]]</a>
			</li>
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin/menu:section-general]]</a>
				<ul class="dropdown-menu" role="menu">
					<li><a href="{relative_path}/admin/general/homepage">[[admin/menu:general/homepage]]</a></li>
					<li><a href="{relative_path}/admin/general/navigation">[[admin/menu:general/navigation]]</a></li>
					<li><a href="{relative_path}/admin/general/languages">[[admin/menu:general/languages]]</a></li>
					<li><a href="{relative_path}/admin/general/sounds">[[admin/menu:general/sounds]]</a></li>
					<li><a href="{relative_path}/admin/general/social">[[admin/menu:general/social]]</a></li>
				</ul>
			</li>
			<li class="dropdown menu-item">
				<a id="manage-menu" href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin/menu:section-manage]]</a>
				<ul class="dropdown-menu" role="menu">
					<li><a id="manage-categories" href="{relative_path}/admin/manage/categories">[[admin/menu:manage/categories]]</a></li>
					<li><a href="{relative_path}/admin/manage/privileges">[[admin/menu:manage/privileges]]</a></li>
					<li><a id="manage-users" href="{relative_path}/admin/manage/users">[[admin/menu:manage/users]]</a></li>
					<li><a href="{relative_path}/admin/manage/admins-mods">[[admin/menu:manage/admins-mods]]</a></li>
					<li><a href="{relative_path}/admin/manage/groups">[[admin/menu:manage/groups]]</a></li>
					<li><a href="{relative_path}/admin/manage/tags">[[admin/menu:manage/tags]]</a></li>
					<li><a href="{relative_path}/admin/manage/registration">[[admin/menu:manage/registration]]</a></li>
					<li><a href="{relative_path}/admin/manage/post-queue">[[admin/menu:manage/post-queue]]</a></li>
					<li><a href="{relative_path}/admin/manage/ip-blacklist">[[admin/menu:manage/ip-blacklist]]</a></li>
					<li><a href="{relative_path}/admin/manage/uploads">[[admin/menu:manage/uploads]]</a></li>
				</ul>
			</li>
			<li class="dropdown menu-item">
				<a id="settings-menu" href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin/menu:section-settings]]</a>
				<ul class="dropdown-menu" role="menu">
					<li><a id="settings-general" href="{relative_path}/admin/settings/general">[[admin/menu:section-general]]</a></li>
					<li><a href="{relative_path}/admin/settings/user">[[admin/menu:settings/user]]</a></li>
					<li><a href="{relative_path}/admin/settings/group">[[admin/menu:settings/group]]</a></li>
					<li><a href="{relative_path}/admin/settings/tags">[[admin/menu:manage/tags]]</a></li>
					<li><a href="{relative_path}/admin/settings/post">[[admin/menu:settings/post]]</a></li>
					<li><a href="{relative_path}/admin/settings/email">[[admin/menu:settings/email]]</a></li>
					<li><a href="{relative_path}/admin/settings/reputation">[[admin/menu:settings/reputation]]</a></li>
					<li><a href="{relative_path}/admin/settings/guest">[[admin/menu:settings/guest]]</a></li>
					<li><a href="{relative_path}/admin/settings/uploads">[[admin/menu:settings/uploads]]</a></li>
					<li><a href="{relative_path}/admin/settings/chat">[[admin/menu:settings/chat]]</a></li>
					<li><a href="{relative_path}/admin/settings/pagination">[[admin/menu:settings/pagination]]</a></li>
					<li><a href="{relative_path}/admin/settings/notifications">[[admin/menu:settings/notifications]]</a></li>
					<li><a href="{relative_path}/admin/settings/cookies">[[admin/menu:settings/cookies]]</a></li>
					<li><a href="{relative_path}/admin/settings/web-crawler">[[admin/menu:settings/web-crawler]]</a></li>
					<li><a href="{relative_path}/admin/settings/sockets">[[admin/menu:settings/sockets]]</a></li>
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
			<!-- IF authentication.length -->
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin/menu:section-social-auth]]</a>
				<ul class="dropdown-menu" role="menu">
					<!-- BEGIN authentication -->
					<li>
						<a href="{relative_path}/admin{authentication.route}">{authentication.name}</a>
					</li>
					<!-- END authentication -->
				</ul>
			</li>
			<!-- ENDIF authentication.length -->
			<!-- IF plugins.length -->
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin/menu:section-plugins]]</a>
				<ul class="dropdown-menu" role="menu">
					<!-- BEGIN plugins -->
					<li>
						<a href="{relative_path}/admin{plugins.route}">{plugins.name}</a>
					</li>
					<!-- END plugins -->
					<li class="divider"></li>
					<li data-link="1">
						<a href="{relative_path}/admin/extend/plugins">[[admin/menu:extend/plugins.install]]</a>
					</li>
				</ul>
			</li>
			<!-- ENDIF plugins.length -->
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin/menu:section-advanced]]</a>
				<ul class="dropdown-menu" role="menu">
					<li><a href="{relative_path}/admin/advanced/database">[[admin/menu:advanced/database]]</a></li>
					<li><a href="{relative_path}/admin/advanced/events">[[admin/menu:advanced/events]]</a></li>
					<li><a href="{relative_path}/admin/advanced/cache">[[admin/menu:advanced/cache]]</a></li>
					<li><a href="{relative_path}/admin/advanced/errors">[[admin/menu:advanced/errors]]</a></li>
					<li><a href="{relative_path}/admin/advanced/logs">[[admin/menu:advanced/logs]]</a></li>
					<!-- IF env -->
					<li><a href="{relative_path}/admin/development/logger">[[admin/menu:development/logger]]</a></li>
					<!-- ENDIF env -->
				</ul>
			</li>
		</ul>
	</nav>
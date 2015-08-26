<nav id="menu" class="visible-xs visible-sm">
	<section class="menu-section">
		<h3 class="menu-section-title">[[admin:partials.menu.general]]</h3>
		<ul class="menu-section-list">
			<a href="{relative_path}/admin/general/dashboard">[[admin:partials.menu.dashboard]]</a>
			<li><a href="{relative_path}/admin/general/homepage">[[admin:partials.menu.home_page]]</a></li>
			<li><a href="{relative_path}/admin/general/navigation">[[admin:partials.menu.navigation]]</a></li>
			<li><a href="{relative_path}/admin/general/languages">[[admin:partials.menu.languages]]</a></li>
			<li><a href="{relative_path}/admin/general/sounds">[[admin:partials.menu.sounds]]</a></li>
		</ul>
	</section>

	<section class="menu-section">
		<h3 class="menu-section-title">[[admin:partials.menu.manage]]</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/manage/categories">[[admin:partials.menu.categories]]</a></li>
			<li><a href="{relative_path}/admin/manage/tags">[[admin:partials.menu.tags]]</a></li>
			<li><a href="{relative_path}/admin/manage/users">[[admin:partials.menu.users]]</a></li>
			<li><a href="{relative_path}/admin/manage/registration">[[admin:partials.menu.registration_queue]]</a></li>
			<li><a href="{relative_path}/admin/manage/groups">[[admin:partials.menu.groups]]</a></li>
			<li><a href="{relative_path}/admin/manage/flags">[[admin:partials.menu.flags]]</a></li>
		</ul>
	</section>

	<section class="menu-section">
		<h3 class="menu-section-title">[[admin:partials.menu.settings]]</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/settings/general">[[admin:partials.menu.general]]</a></li>
			<li><a href="{relative_path}/admin/settings/reputation">[[admin:partials.menu.reputation]]</a></li>
			<li><a href="{relative_path}/admin/settings/email">[[admin:partials.menu.email]]</a></li>
			<li><a href="{relative_path}/admin/settings/user">[[admin:partials.menu.user]]</a></li>
			<li><a href="{relative_path}/admin/settings/group">[[admin:partials.menu.group]]</a></li>
			<li><a href="{relative_path}/admin/settings/guest">[[admin:partials.menu.guests]]</a></li>
			<li><a href="{relative_path}/admin/settings/post">[[admin:partials.menu.post]]</a></li>
			<li><a href="{relative_path}/admin/settings/pagination">[[admin:partials.menu.pagination]]</a></li>
			<li><a href="{relative_path}/admin/settings/tags">[[admin:partials.menu.tags]]</a></li>
			<li><a href="{relative_path}/admin/settings/notifications">[[admin:partials.menu.notifications]]</a></li>
			<li><a href="{relative_path}/admin/settings/web-crawler">[[admin:partials.menu.web_crawler]]</a></li>
			<li><a href="{relative_path}/admin/settings/sockets">[[admin:partials.menu.sockets]]</a></li>
			<li><a href="{relative_path}/admin/settings/advanced">[[admin:partials.menu.advanced]]</a></li>
		</ul>
	</section>

	<section class="menu-section">
		<h3 class="menu-section-title">[[admin:partials.menu.appearance]]</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/appearance/themes">[[admin:partials.menu.themes]]</a></li>
			<li><a href="{relative_path}/admin/appearance/skins">[[admin:partials.menu.skins]]</a></li>
			<li><a href="{relative_path}/admin/appearance/customise">Custom HTML &amp; CSS</a></li>
		</ul>
	</section>

	<section class="menu-section">
		<h3 class="menu-section-title">[[admin:partials.menu.extend]]</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/extend/plugins">[[admin:partials.menu.plugins]]</a></li>
			<li><a href="{relative_path}/admin/extend/widgets">[[admin:partials.menu.widgets]]</a></li>
			<li><a href="{relative_path}/admin/extend/rewards">[[admin:partials.menu.rewards]]</a></li>
		</ul>
	</section>

	<!-- IF authentication.length -->
	<section class="menu-section">
		<h3 class="menu-section-title">[[admin:partials.menu.social_authentication]]</h3>
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
		<h3 class="menu-section-title">[[admin:partials.menu.plugins]]</h3>
		<ul class="menu-section-list">
			<!-- BEGIN plugins -->
			<li>
				<a href="{relative_path}/admin{plugins.route}">{plugins.name}</a>
			</li>
			<!-- END plugins -->
		</ul>
	</section>

	<section class="menu-section">
		<h3 class="menu-section-title">[[admin:partials.menu.advanced]]</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/advanced/database">[[admin:partials.menu.database]]</a></li>
			<li><a href="{relative_path}/admin/advanced/events">[[admin:partials.menu.events]]</a></li>
			<li><a href="{relative_path}/admin/advanced/logs">[[admin:partials.menu.logs]]</a></li>
			<li><a href="{relative_path}/admin/advanced/post-cache">[[admin:partials.menu.post_cache]]</a></li>
			<!-- IF env -->
			<li><a href="{relative_path}/admin/development/logger">[[admin:partials.menu.logger]]</a></li>
			<!-- ENDIF env -->
		</ul>
	</section>
</nav>



<main id="panel">
	<nav class="header" id="header">
		<div class="pull-left">
			<button id="mobile-menu">
				<div class="bar"></div>
				<div class="bar"></div>
				<div class="bar"></div>
			</button>
			<h1 id="main-page-title"></h1>
		</div>

		<ul id="user_label" class="pull-right">
			<li class="dropdown pull-right">
				<a class="dropdown-toggle" data-toggle="dropdown" href="#" id="user_dropdown">
					<i class="fa fa-ellipsis-v"></i>
				</a>
				<ul id="user-control-list" class="dropdown-menu" aria-labelledby="user_dropdown">
					<li>
						<a href="{relative_path}/" target="_blank" title="View Forum">[[admin:partials.menu.view_forum]]</a>
					</li>
					<li role="presentation" class="divider"></li>
					<li>
						<a href="#" class="reload" title="Reload Forum">[[admin:partials.menu.reload_forum]]</a>
					</li>
					<li>
						<a href="#" class="restart" title="Restart Forum">[[admin:partials.menu.restart_forum]]</a>
					</li>
					<li role="presentation" class="divider"></li>
					<li component="logout">
						<a href="#">[[admin:partials.menu.log_out]]</a>
					</li>
				</ul>
			</li>
			<form class="pull-right hidden-sm hidden-xs" role="search">
				<div class="" id="acp-search" >
					<div class="dropdown">
						<input type="text" data-toggle="dropdown" class="form-control" placeholder="Search...">
						<ul class="dropdown-menu dropdown-menu-right" role="menu"></ul>
					</div>
				</div>
			</form>
		</ul>
		<ul id="main-menu">
			<li class="menu-item">
				<a href="{relative_path}/admin/general/dashboard">[[admin:partials.menu.dashboard]]</a>
			</li>
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin:partials.menu.general]]</a>
				<ul class="dropdown-menu" role="menu">
					<li><a href="{relative_path}/admin/general/homepage">[[admin:partials.menu.home_page]]</a></li>
					<li><a href="{relative_path}/admin/general/navigation">[[admin:partials.menu.navigation]]</a></li>
					<li><a href="{relative_path}/admin/general/languages">[[admin:partials.menu.languages]]</a></li>
					<li><a href="{relative_path}/admin/general/sounds">[[admin:partials.menu.sounds]]</a></li>
				</ul>
			</li>
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin:partials.menu.manage]]</a>
				<ul class="dropdown-menu" role="menu">
					<li><a href="{relative_path}/admin/manage/categories">[[admin:partials.menu.categories]]</a></li>
					<li><a href="{relative_path}/admin/manage/tags">[[admin:partials.menu.tags]]</a></li>
					<li><a href="{relative_path}/admin/manage/users">[[admin:partials.menu.users]]</a></li>
					<li><a href="{relative_path}/admin/manage/registration">[[admin:partials.menu.registration_queue]]</a></li>
					<li><a href="{relative_path}/admin/manage/groups">[[admin:partials.menu.groups]]</a></li>
					<li><a href="{relative_path}/admin/manage/flags">[[admin:partials.menu.flags]]</a></li>
				</ul>
			</li>
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin:partials.menu.settings]]</a>
				<ul class="dropdown-menu" role="menu">
					<li><a href="{relative_path}/admin/settings/general">[[admin:partials.menu.general]]</a></li>
					<li><a href="{relative_path}/admin/settings/reputation">[[admin:partials.menu.reputation]]</a></li>
					<li><a href="{relative_path}/admin/settings/email">[[admin:partials.menu.email]]</a></li>
					<li><a href="{relative_path}/admin/settings/user">[[admin:partials.menu.user]]</a></li>
					<li><a href="{relative_path}/admin/settings/group">[[admin:partials.menu.group]]</a></li>
					<li><a href="{relative_path}/admin/settings/guest">[[admin:partials.menu.guests]]</a></li>
					<li><a href="{relative_path}/admin/settings/post">[[admin:partials.menu.post]]</a></li>
					<li><a href="{relative_path}/admin/settings/pagination">[[admin:partials.menu.pagination]]</a></li>
					<li><a href="{relative_path}/admin/settings/tags">[[admin:partials.menu.tags]]</a></li>
					<li><a href="{relative_path}/admin/settings/notifications">[[admin:partials.menu.notifications]]</a></li>
					<li><a href="{relative_path}/admin/settings/web-crawler">[[admin:partials.menu.web_crawler]]</a></li>
					<li><a href="{relative_path}/admin/settings/sockets">[[admin:partials.menu.sockets]]</a></li>
					<li><a href="{relative_path}/admin/settings/advanced">[[admin:partials.menu.advanced]]</a></li>
				</ul>
			</li>
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin:partials.menu.appearance]]</a>
				<ul class="dropdown-menu" role="menu">
					<li><a href="{relative_path}/admin/appearance/themes">[[admin:partials.menu.themes]]</a></li>
					<li><a href="{relative_path}/admin/appearance/skins">[[admin:partials.menu.skins]]</a></li>
					<li><a href="{relative_path}/admin/appearance/customise">Custom HTML &amp; CSS</a></li>
				</ul>
			</li>
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin:partials.menu.extend]]</a>
				<ul class="dropdown-menu" role="menu">
					<li><a href="{relative_path}/admin/extend/plugins">[[admin:partials.menu.plugins]]</a></li>
					<li><a href="{relative_path}/admin/extend/widgets">[[admin:partials.menu.widgets]]</a></li>
					<li><a href="{relative_path}/admin/extend/rewards">[[admin:partials.menu.rewards]]</a></li>
				</ul>
			</li>
			<!-- IF authentication.length -->
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin:partials.menu.social_authentication]]</a>
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
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin:partials.menu.plugins]]</a>
				<ul class="dropdown-menu" role="menu">
					<!-- BEGIN plugins -->
					<li>
						<a href="{relative_path}/admin{plugins.route}">{plugins.name}</a>
					</li>
					<!-- END plugins -->
					<li class="divider"></li>
					<li data-link="1">
						<a href="{relative_path}/admin/extend/plugins">[[admin:partials.menu.install_plugins]]</a>
					</li>
				</ul>
			</li>
			<!-- ENDIF plugins.length -->
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">[[admin:partials.menu.advanced]]</a>
				<ul class="dropdown-menu" role="menu">
					<li><a href="{relative_path}/admin/advanced/database">[[admin:partials.menu.database]]</a></li>
					<li><a href="{relative_path}/admin/advanced/events">[[admin:partials.menu.events]]</a></li>
					<li><a href="{relative_path}/admin/advanced/logs">[[admin:partials.menu.logs]]</a></li>
					<li><a href="{relative_path}/admin/advanced/post-cache">[[admin:partials.menu.post_cache]]</a></li>
					<!-- IF env -->
					<li><a href="{relative_path}/admin/development/logger">[[admin:partials.menu.logger]]</a></li>
					<!-- ENDIF env -->
				</ul>
			</li>
		</ul>
	</nav>

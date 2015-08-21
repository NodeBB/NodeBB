				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-dashboard"></i> [[admin:partials.menu.general]]</li>
						<li class="active"><a href="{relative_path}/admin/general/dashboard">[[admin:partials.menu.dashboard]]</a></li>
						<li><a href="{relative_path}/admin/general/homepage">[[admin:partials.menu.home_page]]</a></li>
						<li><a href="{relative_path}/admin/general/navigation">[[admin:partials.menu.navigation]]</a></li>
						<li><a href="{relative_path}/admin/general/languages">[[admin:partials.menu.languages]]</a></li>
						<li><a href="{relative_path}/admin/general/sounds">[[admin:partials.menu.sounds]]</a></li>
					</ul>
				</div>
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-comments-o"></i> [[admin:partials.menu.manage]]</li>
						<li><a href="{relative_path}/admin/manage/categories">[[admin:partials.menu.categories]]</a></li>
						<li><a href="{relative_path}/admin/manage/tags">[[admin:partials.menu.tags]]</a></li>
						<li><a href="{relative_path}/admin/manage/users">[[admin:partials.menu.users]]</a></li>
						<li><a href="{relative_path}/admin/manage/groups">[[admin:partials.menu.groups]]</a></li>
						<li><a href="{relative_path}/admin/manage/flags">[[admin:partials.menu.flags]]</a></li>
					</ul>
				</div>
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-cogs"></i> [[admin:partials.menu.settings]]</li>
						<li><a href="{relative_path}/admin/settings/general">[[admin:partials.menu.general]]</a></li>
						<li><a href="{relative_path}/admin/settings/reputation">[[admin:partials.menu.reputation]]</a></li>
						<li><a href="{relative_path}/admin/settings/email">[[admin:partials.menu.email]]</a></li>
						<li><a href="{relative_path}/admin/settings/user">[[admin:partials.menu.user]]</a></li>
						<li><a href="{relative_path}/admin/settings/group">[[admin:partials.menu.group]]</a></li>
						<li><a href="{relative_path}/admin/settings/guest">[[admin:partials.menu.guest]]</a></li>
						<li><a href="{relative_path}/admin/settings/post">[[admin:partials.menu.post]]</a></li>
						<li><a href="{relative_path}/admin/settings/pagination">[[admin:partials.menu.pagination]]</a></li>
						<li><a href="{relative_path}/admin/settings/tags">[[admin:partials.menu.tags]]</a></li>
						<li><a href="{relative_path}/admin/settings/notifications">[[admin:partials.menu.notifications]]</a></li>
						<li><a href="{relative_path}/admin/settings/web-crawler">[[admin:partials.menu.web_crawler]]</a></li>
						<li><a href="{relative_path}/admin/settings/sockets">[[admin:partials.menu.sounds]]</a></li>
						<li><a href="{relative_path}/admin/settings/advanced">[[admin:partials.menu.advanced]]</a></li>
					</ul>
				</div>
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-paint-brush"></i> [[admin:partials.menu.appearance]]</li>
						<li><a href="{relative_path}/admin/appearance/themes">[[admin:partials.menu.themes]]</a></li>
						<li><a href="{relative_path}/admin/appearance/skins">[[admin:partials.menu.skins]]</a></li>
						<li><a href="{relative_path}/admin/appearance/customise">[[admin:partials.menu.customise]]</a></li>
					</ul>
				</div>
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-wrench"></i> [[admin:partials.menu.extend]]</li>
						<li><a href="{relative_path}/admin/extend/plugins">[[admin:partials.menu.plugins]]</a></li>
						<li><a href="{relative_path}/admin/extend/widgets">[[admin:partials.menu.widgets]]</a></li>
						<li><a href="{relative_path}/admin/extend/rewards">[[admin:partials.menu.rewards]]</a></li>
					</ul>
				</div>
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-hdd-o"></i> [[admin:partials.menu.advanced]]</li>
						<li><a href="{relative_path}/admin/advanced/database">[[admin:partials.menu.database]]</a></li>
						<li><a href="{relative_path}/admin/advanced/events">[[admin:partials.menu.events]]</a></li>
						<li><a href="{relative_path}/admin/advanced/logs">[[admin:partials.menu.logs]]</a></li>
						<li><a href="{relative_path}/admin/advanced/post-cache">[[admin:partials.menu.post_cache]]</a></li>
					</ul>
				</div>
				<!-- IF authentication.length -->
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-facebook-square"></i> [[admin:partials.menu.social_authentication]]</li>
						<!-- BEGIN authentication -->
						<li>
							<a href="{relative_path}/admin{authentication.route}">{authentication.name}</a>
						</li>
						<!-- END authentication -->
					</ul>
				</div>
				<!-- ENDIF authentication.length -->
				<!-- IF plugins.length -->
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-th"></i> [[admin:partials.menu.installed_plugins]]</li>
						<!-- BEGIN plugins -->
						<li>
							<a href="{relative_path}/admin{plugins.route}">
							<!-- IF plugins.icon -->
							<i class="fa {plugins.icon}"></i>
							<!-- ENDIF plugins.icon -->
							{plugins.name}
							</a>
						</li>
						<!-- END plugins -->
						<li data-link="1">
							<a href="{relative_path}/admin/extend/plugins"><i class="fa fa-plus"></i> [[admin:partials.menu.install_plugins]]</a>
						</li>
					</ul>
				</div>
				<!-- ENDIF plugins.length -->
				<!-- IF env -->
				<div class="sidebar-nav">
					<ul class="nav nav-list">
						<li class="nav-header"><i class="fa fa-fw fa-th"></i> [[admin:partials.menu.development]]</li>
						<li><a href="{relative_path}/admin/development/logger">[[admin:partials.menu.logger]]</a></li>
					</ul>
				</div>
				<!-- ENDIF env -->
<nav id="menu" class="hidden-md hidden-lg admin-menu">
	<section class="menu-section">
		<h3 class="menu-section-title">[[admin/menu:section-general]]</h3>
		<ul class="menu-section-list">
			<a href="{relative_path}/admin/general/dashboard">[[admin/menu:general/dashboard]]</a>
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
			<li><a href="{relative_path}/admin/manage/tags">[[admin/menu:manage/tags]]</a></li>
			<li><a href="{relative_path}/admin/manage/users">[[admin/menu:manage/users]]</a></li>
			<li><a href="{relative_path}/admin/manage/registration">[[admin/menu:manage/registration]]</a></li>
			<li><a href="{relative_path}/admin/manage/groups">[[admin/menu:manage/groups]]</a></li>
			<li><a href="{relative_path}/admin/manage/flags">[[admin/menu:manage/flags]]</a></li>
			<li><a href="{relative_path}/admin/manage/ip-blacklist">[[admin/menu:manage/ip-blacklist]]</a></li>
		</ul>
	</section>

	<section class="menu-section">
		<h3 class="menu-section-title">[[admin/menu:section-settings]]</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/settings/general">[[admin/menu:section-general]]</a></li>
			<li><a href="{relative_path}/admin/settings/reputation">[[admin/menu:settings/reputation]]</a></li>
			<li><a href="{relative_path}/admin/settings/email">[[admin/menu:settings/email]]</a></li>
			<li><a href="{relative_path}/admin/settings/user">[[admin/menu:settings/user]]</a></li>
			<li><a href="{relative_path}/admin/settings/group">[[admin/menu:settings/group]]</a></li>
			<li><a href="{relative_path}/admin/settings/guest">[[admin/menu:settings/guest]]</a></li>
			<li><a href="{relative_path}/admin/settings/uploads">[[admin/menu:settings/uploads]]</a></li>
			<li><a href="{relative_path}/admin/settings/post">[[admin/menu:settings/post]]</a></li>
			<li><a href="{relative_path}/admin/settings/chat">[[admin/menu:settings/chat]]</a></li>
			<li><a href="{relative_path}/admin/settings/pagination">[[admin/menu:settings/pagination]]</a></li>
			<li><a href="{relative_path}/admin/settings/tags">[[admin/menu:manage/tags]]</a></li>
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
			<li><a href="{relative_path}/admin/advanced/logs">[[admin/menu:advanced/logs]]</a></li>
			<li><a href="{relative_path}/admin/advanced/errors">[[admin/menu:advanced/errors]]</a></li>
			<li><a href="{relative_path}/admin/advanced/cache">[[admin/menu:advanced/cache]]</a></li>
			<!-- IF env -->
			<li><a href="{relative_path}/admin/development/logger">[[admin/menu:development/logger]]</a></li>
			<!-- ENDIF env -->
		</ul>
	</section>
</nav>

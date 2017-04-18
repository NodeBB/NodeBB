<nav id="menu" class="hidden-md hidden-lg moderator-menu">

	<section class="menu-section">
		<h3 class="menu-section-title">[[admin/menu:section-general]]</h3>
		<ul class="menu-section-list">
			<a href="{relative_path}/admin/general/dashboard">[[admin/menu:general/dashboard]]</a>
			<li><a href="{relative_path}/admin/general/homepage">[[admin/menu:general/homepage]]</a></li>
		</ul>
	</section>

	<section class="menu-section">
		<h3 class="menu-section-title">[[admin/menu:section-manage]]</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/manage/categories">[[admin/menu:manage/categories]]</a></li>
			<li><a href="{relative_path}/admin/manage/tags">[[admin/menu:manage/tags]]</a></li>
		</ul>
	</section>
</nav>

<main id="panel">
	<nav class="header moderator-menu" id="header">
		<div class="pull-left">
			<div id="mobile-menu">
				<div class="bar"></div>
				<div class="bar"></div>
				<div class="bar"></div>
			</div>
			<h1 id="main-page-title">Dashboard</h1>
		</div>

		<ul id="user_label" class="pull-right">
			<li class="pull-right">
				<a href="{config.relative_path}/">
					<i class="fa fa-fw fa-home" title="[[admin/menu:view-forum]]"></i>
				</a>
			</li>
		</ul>

		<ul id="main-menu">
			<li class="dropdown menu-item">
				<a href="{relative_path}/admin/manage/categories">[[admin/menu:manage/categories]]</a>
			</li>
		</ul>

		<ul class="nav navbar-nav navbar-right hidden-xs reconnect-spinner">
			<li>
				<a href="#" id="reconnect" class="hide" title="[[admin/menu:connection-lost, {title}]]">
					<i class="fa fa-check"></i>
				</a>
			</li>
		</ul>
	</nav>

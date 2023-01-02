
<div class="notifications">

	<!-- IMPORT partials/breadcrumbs.tpl -->

	<div class="btn-toolbar">
		<div class="dropdown pull-right">
			<button class="btn btn-default dropdown-toggle" type="button" data-toggle="dropdown" aria-expanded="true">
				<i class="fa fa-eye"></i>
				<span class="caret"></span>
			</button>
			<ul class="dropdown-menu dropdown-menu-right" role="menu" aria-labelledby="dropdownMenu1">
				<li role="presentation"><a role="menuitem" tabindex="-1" href="#" data-ajaxify="false" component="notifications/mark_all">[[notifications:mark_all_read]]</a></li>
			</ul>
		</div>

		<div class="dropdown pull-right">
			<button class="btn btn-default dropdown-toggle" type="button" data-toggle="dropdown">
				<!-- IF selectedFilter -->{selectedFilter.name}<!-- ENDIF selectedFilter --> <span class="caret"></span>
			</button>
			<ul class="dropdown-menu" role="menu">
				{{{each filters}}}
				<!-- IF filters.separator -->
				<li role="separator" class="divider"></li>
				<!-- ELSE -->
				<li role="presentation" class="category">
					<a role="menu-item" href="{config.relative_path}/notifications?filter={filters.filter}"><i class="fa fa-fw <!-- IF filters.selected -->fa-check<!-- ENDIF filters.selected -->"></i> {filters.name}</a>
				</li>
				<!-- ENDIF filters.separator -->
				{{{end}}}
			</ul>
		</div>
	</div>

	<hr />

	<div class="alert alert-info <!-- IF notifications.length -->hidden<!-- ENDIF notifications.length -->">
		[[notifications:no_notifs]]
	</div>

	<ul class="notifications-list" data-nextstart="{nextStart}">
	{{{each notifications}}}
		<li data-nid="{notifications.nid}" class="{notifications.readClass}" component="notifications/item">
			<!-- IF notifications.image -->
			<!-- IF notifications.from -->
			<a class="pull-left" href="{config.relative_path}/user/{notifications.user.userslug}"><img class="user-img" src="{notifications.image}" /></a>
			<!-- ENDIF notifications.from -->
			<!-- ELSE -->
			<a class="pull-left" href="{config.relative_path}/user/{notifications.user.userslug}"><div class="pull-left user-icon user-img" style="background-color: {notifications.user.icon:bgColor};">{notifications.user.icon:text}</div></a>
			<!-- ENDIF notifications.image -->

			<p>
				<a component="notifications/item/link" href="{notifications.path}">{notifications.bodyShort}</a>
			</p>
			<p class="timestamp">
				<span class="timeago" title="{notifications.datetimeISO}"></span>
			</p>
		</li>
	{{{end}}}
	</ul>
	<!-- IMPORT partials/paginator.tpl -->
</div>



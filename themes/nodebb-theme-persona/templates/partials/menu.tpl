			<div class="navbar-header">
				<button type="button" class="navbar-toggle pull-left" id="mobile-menu">
					<i class="fa fa-lg fa-fw fa-bars unread-count" data-content="{unreadCount.mobileUnread}" data-unread-url="{unreadCount.unreadUrl}"></i>
				</button>
				{{{ if config.loggedIn }}}
				<button type="button" class="navbar-toggle" id="mobile-chats">
					<span component="notifications/icon" class="notification-icon fa fa-fw fa-bell-o unread-count" data-content="{unreadCount.notification}"></span>
					<span component="chat/icon" class="notification-icon fa fa-fw fa-comments unread-count" data-content="{unreadCount.chat}"></span>
					{buildAvatar(user, "md", true)}
				</button>
				{{{ end }}}

				{{{ if config.searchEnabled }}}
				<div class="navbar-search visible-xs pull-right">
					<form action="{config.relative_path}/search" method="GET">
						<button type="button" class="btn btn-link"><i class="fa fa-lg fa-fw fa-search" title="[[global:header.search]]"></i></button>
						<input autocomplete="off" type="text" class="form-control hidden" name="term" placeholder="[[global:search]]"/>
						<button class="btn btn-primary hidden" type="submit"></button>
						<input type="text" class="hidden" name="in" value="{config.searchDefaultInQuick}" />
					</form>
					<div class="quick-search-container hidden">
						<div class="quick-search-results-container"></div>
					</div>
				</div>
				{{{ end }}}

				<!-- IF brand:logo -->
				<a href="<!-- IF brand:logo:url -->{brand:logo:url}<!-- ELSE -->{relative_path}/<!-- ENDIF brand:logo:url -->">
					<img alt="{brand:logo:alt}" class="{brand:logo:display} forum-logo" src="{brand:logo}?{config.cache-buster}" />
				</a>
				<!-- ENDIF brand:logo -->
				<!-- IF config.showSiteTitle -->
				<a href="<!-- IF title:url -->{title:url}<!-- ELSE -->{relative_path}/<!-- ENDIF title:url -->">
					<h1 class="navbar-brand forum-title">{config.siteTitle}</h1>
				</a>
				<!-- ENDIF config.showSiteTitle -->

				<div component="navbar/title" class="visible-xs hidden">
					<span></span>
				</div>
			</div>

			<div id="nav-dropdown" class="hidden-xs">
				<!-- IF !maintenanceHeader -->
				<!-- IF config.loggedIn -->

				<ul id="logged-in-menu" class="nav navbar-nav navbar-right">
					<li class="notifications dropdown text-center hidden-xs" component="notifications">
						<a href="{relative_path}/notifications" title="[[global:header.notifications]]" class="dropdown-toggle" data-toggle="dropdown" id="notif_dropdown" data-ajaxify="false" role="button">
							<i component="notifications/icon" class="fa fa-fw fa-bell-o unread-count" data-content="{unreadCount.notification}"></i>
						</a>
						<ul class="dropdown-menu" aria-labelledby="notif_dropdown">
							<li>
								<ul component="notifications/list" class="notification-list">
									<li class="loading-text">
										<a href="#"><i class="fa fa-refresh fa-spin"></i> [[global:notifications.loading]]</a>
									</li>
								</ul>
							</li>
							<li class="notif-dropdown-link">
								<div class="btn-group btn-group-justified">
									<a role="button" href="#" class="btn btn-secondary mark-all-read"><i class="fa fa-check-double"></i> [[notifications:mark_all_read]]</a>
									<a class="btn btn-secondary" href="{relative_path}/notifications"><i class="fa fa-list"></i> [[notifications:see_all]]</a>
								</div>
							</li>
						</ul>
					</li>

					<!-- IF canChat -->
					<li class="chats dropdown">
						<a class="dropdown-toggle" data-toggle="dropdown" href="{relative_path}/user/{user.userslug}/chats" title="[[global:header.chats]]" id="chat_dropdown" component="chat/dropdown" data-ajaxify="false" role="button">
							<i component="chat/icon" class="fa fa-comment-o fa-fw unread-count" data-content="{unreadCount.chat}"></i> <span class="visible-xs-inline">[[global:header.chats]]</span>
						</a>
						<ul class="dropdown-menu" aria-labelledby="chat_dropdown">
							<li>
								<ul component="chat/list" class="chat-list chats-list">
									<li class="loading-text">
										<a href="#"><i class="fa fa-refresh fa-spin"></i> [[global:chats.loading]]</a>
									</li>
								</ul>
							</li>
							<li class="notif-dropdown-link">
								<div class="btn-group btn-group-justified">
									<a class="btn btn-secondary mark-all-read" href="#" component="chats/mark-all-read"><i class="fa fa-check-double"></i> [[modules:chat.mark_all_read]]</a>
									<a class="btn btn-secondary" href="{relative_path}/user/{user.userslug}/chats"><i class="fa fa-comments"></i> [[modules:chat.see_all]]</a>
								</div>
							</li>
						</ul>
					</li>
					<!-- ENDIF canChat -->

					<li id="user_label" class="dropdown">
						<label for="user-control-list-check" class="dropdown-toggle" data-toggle="dropdown" id="user_dropdown" title="[[global:header.profile]]" role="button">
							{buildAvatar(user, "md", true)}
							<span id="user-header-name" class="visible-xs-inline">{user.username}</span>
						</label>
						<input type="checkbox" class="hidden" id="user-control-list-check" aria-hidden="true">
						<ul id="user-control-list" component="header/usercontrol" class="dropdown-menu" aria-labelledby="user_dropdown">
							<li>
								<a component="header/profilelink" href="{relative_path}/user/{user.userslug}">
									<i component="user/status" class="fa fa-fw fa-circle status {user.status}"></i> <span component="header/username">{user.username}</span>
								</a>
							</li>
							<li role="presentation" class="divider"></li>
							<li>
								<a href="#" class="user-status" data-status="online">
									<i class="fa fa-fw fa-circle status online"></i><span <!-- IF user.online -->class="bold"<!-- ENDIF user.online -->> [[global:online]]</span>
								</a>
							</li>
							<li>
								<a href="#" class="user-status" data-status="away">
									<i class="fa fa-fw fa-circle status away"></i><span <!-- IF user.away -->class="bold"<!-- ENDIF user.away -->> [[global:away]]</span>
								</a>
							</li>
							<li>
								<a href="#" class="user-status" data-status="dnd">
									<i class="fa fa-fw fa-circle status dnd"></i><span <!-- IF user.dnd -->class="bold"<!-- ENDIF user.dnd -->> [[global:dnd]]</span>
								</a>
							</li>
							<li>
								<a href="#" class="user-status" data-status="offline">
									<i class="fa fa-fw fa-circle status offline"></i><span <!-- IF user.offline -->class="bold"<!-- ENDIF user.offline -->> [[global:invisible]]</span>
								</a>
							</li>
							<li role="presentation" class="divider"></li>
							<li>
								<a component="header/profilelink/edit" href="{relative_path}/user/{user.userslug}/edit">
									<i class="fa fa-fw fa-edit"></i> <span>[[user:edit-profile]]</span>
								</a>
							</li>
							<li>
								<a component="header/profilelink/settings" href="{relative_path}/user/{user.userslug}/settings">
									<i class="fa fa-fw fa-gear"></i> <span>[[user:settings]]</span>
								</a>
							</li>
							{{{ if showModMenu }}}
							<li role="presentation" class="divider"></li>
							<li class="dropdown-header">[[pages:moderator-tools]]</li>
							<li>
								<a href="{relative_path}/flags">
									<i class="fa fa-fw fa-flag"></i> <span>[[pages:flagged-content]]</span>
								</a>
							</li>
							<li>
								<a href="{relative_path}/post-queue">
									<i class="fa fa-fw fa-list-alt"></i> <span>[[pages:post-queue]]</span>
								</a>
							</li>
							<li>
								<a href="{relative_path}/ip-blacklist">
									<i class="fa fa-fw fa-ban"></i> <span>[[pages:ip-blacklist]]</span>
								</a>
							</li>
							{{{ else }}}
							{{{ if postQueueEnabled }}}
							<li>
								<a href="{relative_path}/post-queue">
									<i class="fa fa-fw fa-list-alt"></i> <span>[[pages:post-queue]]</span>
								</a>
							</li>
							{{{ end }}}
							{{{ end }}}

							<li role="presentation" class="divider"></li>
							<li component="user/logout">
								<form method="post" action="{relative_path}/logout">
									<input type="hidden" name="_csrf" value="{config.csrf_token}">
									<input type="hidden" name="noscript" value="true">
									<button type="submit" class="btn btn-link">
										<i class="fa fa-fw fa-sign-out"></i><span> [[global:logout]]</span>
									</button>
								</form>
							</li>
						</ul>
					</li>

				</ul>
				<!-- ELSE -->
				<ul id="logged-out-menu" class="nav navbar-nav navbar-right">
					<!-- IF allowRegistration -->
					<li>
						<a href="{relative_path}/register">
							<i class="fa fa-pencil fa-fw hidden-sm hidden-md hidden-lg"></i>
							<span>[[global:register]]</span>
						</a>
					</li>
					<!-- ENDIF allowRegistration -->
					<li>
						<a href="{relative_path}/login">
							<i class="fa fa-sign-in fa-fw hidden-sm hidden-md hidden-lg"></i>
							<span>[[global:login]]</span>
						</a>
					</li>
				</ul>
				<!-- ENDIF config.loggedIn -->
				<!-- IF config.searchEnabled -->
				<ul class="nav navbar-nav navbar-right">
					<li>
						<form id="search-form" class="navbar-form navbar-right hidden-xs" role="search" method="GET">
							<button id="search-button" type="button" class="btn btn-link"><i class="fa fa-search fa-fw" title="[[global:header.search]]"></i></button>
							<div class="hidden" id="search-fields">
								<div class="form-group">
									<input autocomplete="off" type="text" class="form-control" placeholder="[[global:search]]" name="query" value="">
									<a href="#"><i class="fa fa-gears fa-fw advanced-search-link"></i></a>
								</div>
								<button type="submit" class="btn btn-default hide">[[global:search]]</button>
							</div>
						</form>
						<div id="quick-search-container" class="quick-search-container hidden">
							<div class="checkbox filter-category">
								<label>
									<input type="checkbox" checked><span class="name"></span>
								</label>
							</div>
							<div class="text-center loading-indicator"><i class="fa fa-spinner fa-spin"></i></div>
							<div class="quick-search-results-container"></div>
						</div>
					</li>
					<li class="visible-xs" id="search-menu">
						<a href="{relative_path}/search">
							<i class="fa fa-search fa-fw"></i> [[global:search]]
						</a>
					</li>
				</ul>
				<!-- ENDIF config.searchEnabled -->

				<ul class="nav navbar-nav navbar-right hidden-xs">
					<li>
						<a href="#" id="reconnect" class="hide" title="[[global:reconnecting-message, {config.siteTitle}]]">
							<i class="fa fa-check"></i>
						</a>
					</li>
				</ul>

				<ul id="main-nav" class="nav navbar-nav">
					{{{each navigation}}}
					<!-- IF function.displayMenuItem, @index -->
					<li class="{navigation.class}{{{ if navigation.dropdown }}} dropdown{{{ end }}}">
						<a title="{navigation.title}" class="navigation-link {{{ if navigation.dropdown }}}dropdown-toggle{{{ end }}}"
						{{{ if navigation.dropdown }}} href="#" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" {{{ else }}} href="{navigation.route}"{{{ end }}} {{{ if navigation.id }}}id="{navigation.id}"{{{ end }}}{{{ if navigation.targetBlank }}} target="_blank"{{{ end }}}>
							{{{ if navigation.iconClass }}}
							<i class="fa fa-fw {navigation.iconClass}" data-content="{navigation.content}"></i>
							{{{ end }}}
							{{{ if navigation.text }}}
							<span class="{navigation.textClass}">{navigation.text}</span>
							{{{ end }}}
							{{{ if navigation.dropdown}}}
							<i class="fa fa-caret-down"></i>
							{{{ end }}}
						</a>
						{{{ if navigation.dropdown }}}
						<ul class="dropdown-menu">
							{navigation.dropdownContent}
						</ul>
						{{{ end }}}
					</li>
					<!-- ENDIF function.displayMenuItem -->
					{{{end}}}
				</ul>

				<!-- ELSE -->
				<ul class="nav navbar-nav navbar-right">
					<li>
						<a href="{relative_path}/login">
							<i class="fa fa-sign-in fa-fw hidden-sm hidden-md hidden-lg"></i>
							<span>[[global:login]]</span>
						</a>
					</li>
				</ul>
				<!-- ENDIF !maintenanceHeader -->
			</div>

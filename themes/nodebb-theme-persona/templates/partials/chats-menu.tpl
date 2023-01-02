{{{ if config.loggedIn }}}
<ul class="nav nav-pills">
	<li>
		<a href="#notifications" data-toggle="tab"><span class="counter unread-count" component="notifications/icon" data-content="{unreadCount.notification}"></span> <i class="fa fa-fw fa-bell"></i></a>
	</li>
	{{{ if !config.disableChat }}}
	<li>
		<a href="#chats" data-toggle="tab"><i class="counter unread-count" component="chat/icon" data-content="{unreadCount.chat}"></i> <i class="fa fa-fw fa-comment"></i></a>
	</li>
	{{{ end }}}
	<li class="active">
		<a href="#profile" data-toggle="tab">
			{buildAvatar(user, "sm", true, "user-icon")}
			<i component="user/status" class="fa fa-fw fa-circle status {user.status}"></i>
		</a>
	</li>
</ul>

<div class="tab-content">
	<div class="tab-pane fade active in" id="profile">
		<section class="menu-section" data-section="profile">
			<ul class="menu-section-list" component="header/usercontrol"></ul>
		</section>
	</div>
	<div class="tab-pane fade" id="notifications">
		<section class="menu-section" data-section="notifications">
			<ul class="menu-section-list notification-list-mobile" component="notifications/list"></ul>
			<p class="menu-section-list"><a href="{relative_path}/notifications">[[notifications:see_all]]</a></p>
		</section>
	</div>
	{{{ if !config.disableChat }}}
	<div class="tab-pane fade" id="chats">
		<section class="menu-section" data-section="chats">
			<ul class="menu-section-list chat-list" component="chat/list">
				<a class="navigation-link" href="{relative_path}/user/{user.userslug}/chats">[[modules:chat.see_all]]</a>
			</ul>
		</section>
	</div>
	{{{ end }}}
</div>
{{{ end }}}
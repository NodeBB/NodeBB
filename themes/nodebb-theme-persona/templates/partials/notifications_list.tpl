
<!-- IF !notifications.length -->
<li class="no-notifs"><a href="#">[[notifications:no_notifs]]</a></li>
<!-- ENDIF !notifications.length -->

{{{each notifications}}}
<li class="{notifications.readClass}" data-nid="{notifications.nid}" data-path="{notifications.path}" <!-- IF notifications.pid --> data-pid="{notifications.pid}"<!-- ENDIF notifications.pid --><!-- IF notifications.tid --> data-tid="{notifications.tid}"<!-- ENDIF notifications.tid -->>
	<!-- IF notifications.image -->
	<!-- IF notifications.from -->
	<a href="{config.relative_path}/user/{notifications.user.userslug}"><img class="pull-left user-img avatar avatar-md avatar-rounded"src="{notifications.image}" /></a>
	<!-- ENDIF notifications.from -->
	<!-- ELSE -->
	<a href="{config.relative_path}/user/{notifications.user.userslug}"><div class="pull-left avatar avatar-md avatar-rounded" style="background-color: {notifications.user.icon:bgColor};">{notifications.user.icon:text}</div></a>
	<!-- ENDIF notifications.image -->

	<a href="{notifications.path}" class="notification-chat-content deco-none">
		<span class="text">{notifications.bodyShort}</span>
	</a>

	<div class="notification-chat-controls">
		{{{ if ./nid }}}<div class="mark-read" aria-label="Mark Read"></div>{{{ end }}}
		<span class="relTime">{notifications.timeago}</span>
	</div>
</li>
{{{end}}}

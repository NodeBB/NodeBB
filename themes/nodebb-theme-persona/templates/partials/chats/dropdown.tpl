<!-- IF rooms.length -->
{{{each rooms}}}
<li class="<!-- IF ../unread -->unread<!-- ENDIF ../unread -->" data-roomid="{rooms.roomId}">
	{{{each rooms.users}}}
	<!-- IF @first -->
	<div class="main-avatar">
		<!-- IMPORT partials/chats/user.tpl -->
	</div>
	<!-- ENDIF @first -->
	{{{end}}}

	<ul class="members">
		{{{each rooms.users}}}
		<li>
			<!-- IMPORT partials/chats/user.tpl -->
		</li>
		{{{end}}}
	</ul>

	<div class="notification-chat-content">
		<strong class="room-name">
			<!-- IF !rooms.lastUser.uid -->
			<span>[[modules:chat.no-users-in-room]]</span>
			<!-- ELSE -->
			<!-- IF rooms.roomName -->{rooms.roomName}<!-- ELSE -->{rooms.usernames}<!-- ENDIF rooms.roomName -->
			<!-- ENDIF !rooms.lastUser.uid -->
		</strong>
		<span class="teaser-content">
			<strong class="teaser-username">{rooms.teaser.user.username}:</strong>
			{rooms.teaser.content}
		</span>
	</div>
	<div class="teaser-timestamp notification-chat-controls">{rooms.teaser.timeago}</div>
</li>
{{{end}}}
<!-- ELSE -->
<li class="no_active"><a href="#">[[modules:chat.no_active]]</a></li>
<!-- ENDIF rooms.length -->
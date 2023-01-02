<li component="chat/recent/room" data-roomid="{rooms.roomId}" class="<!-- IF rooms.unread -->unread<!-- ENDIF rooms.unread -->">
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
			<span component="chat/title"><!-- IF rooms.roomName -->{rooms.roomName}<!-- ELSE -->{rooms.usernames}<!-- ENDIF rooms.roomName --></span>
			<!-- ENDIF !rooms.lastUser.uid -->
		</strong>
	</div>
</li>
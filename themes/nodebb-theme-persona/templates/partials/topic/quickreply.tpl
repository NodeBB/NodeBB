<!-- IF privileges.topics:reply -->
<div component="topic/quickreply/container" class="clearfix quick-reply">
	<div class="icon pull-left hidden-xs">
		<a href="<!-- IF posts.user.userslug -->{config.relative_path}/user/{posts.user.userslug}<!-- ELSE -->#<!-- ENDIF posts.user.userslug -->">
			{buildAvatar(loggedInUser, "46", true, "", "user/picture")}
			<!-- IF loggedInUser.status -->
			<i component="user/status" class="fa fa-circle status {loggedInUser.status}" title="[[global:{loggedInUser.status}]]"></i>
			<!-- ENDIF loggedInUser.status -->
		</a>
	</div>
	<form method="post" action="{config.relative_path}/compose">
		<input type="hidden" name="tid" value="{tid}" />
		<input type="hidden" name="_csrf" value="{config.csrf_token}" />
		<div class="quickreply-message">
			<textarea name="content" component="topic/quickreply/text" class="form-control mousetrap" rows="5" placeholder="[[modules:composer.textarea.placeholder]]"></textarea>
			<div class="imagedrop"><div>[[topic:composer.drag_and_drop_images]]</div></div>
		</div>
		<div class="btn-group pull-right">
			<button type="submit" component="topic/quickreply/button" class="btn btn-primary">[[topic:post-quick-reply]]</button>
			<button type="submit" component="topic/quickreply/expand" class="btn btn-default" formmethod="get"><i class="fa fa-expand"></i></button>
		</div>
	</form>
	<form component="topic/quickreply/upload" method="post" enctype="multipart/form-data">
		<input type="file" name="files[]" multiple class="hidden"/>
	</form>

</div>
<!-- ENDIF privileges.topics:reply -->

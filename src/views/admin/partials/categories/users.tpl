<!-- BEGIN users -->
<li data-uid="{users.uid}">
	<div class="btn-group pull-right">
		<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">
			Privileges <span class="caret"></span>
		</button>
		<ul class="dropdown-menu" role="menu">
			<li role="presentation"><a href="#" data-priv="find" class="<!-- IF users.privileges.find -->active<!-- ENDIF users.privileges.find -->">Find Category</a></li>
			<li role="presentation"><a href="#" data-priv="read" class="<!-- IF users.privileges.read -->active<!-- ENDIF users.privileges.read -->">Access Category</a></li>
			<li role="presentation"><a href="#" data-priv="topics:read" class="<!-- IF users.privileges.topics:read -->active<!-- ENDIF users.privileges.topics:read -->">Access Topics</a></li>
			<li role="presentation"><a href="#" data-priv="topics:create" class="<!-- IF users.privileges.topics:create -->active<!-- ENDIF users.privileges.topics:create -->">Create Topics</a></li>
			<li role="presentation"><a href="#" data-priv="topics:reply" class="<!-- IF users.privileges.topics:reply -->active<!-- ENDIF users.privileges.topics:reply -->">Reply to Topics</a></li>
			<li role="presentation"><a href="#" data-priv="posts:edit" class="<!-- IF users.privileges.posts:edit -->active<!-- ENDIF users.privileges.posts:edit -->">Edit Posts</a></li>
			<li role="presentation"><a href="#" data-priv="posts:delete" class="<!-- IF users.privileges.posts:delete -->active<!-- ENDIF users.privileges.posts:delete -->">Delete Posts</a></li>
			<li role="presentation"><a href="#" data-priv="topics:delete" class="<!-- IF users.privileges.topics:delete -->active<!-- ENDIF users.privileges.topics:delete -->">Delete Topics</a></li>
			<li role="presentation" class="divider"></li>
			<li role="presentation"><a href="#" data-priv="mods" class="<!-- IF users.privileges.mods -->active<!-- ENDIF users.privileges.mods -->">Moderator</a></li>
		</ul>
	</div>
	<img src="{users.picture}" /> {users.username}
</li>
<!-- END users -->

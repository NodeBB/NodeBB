<!-- BEGIN groups -->
<li data-name="{groups.displayName}">
	<div class="btn-group pull-right">
		<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">
			Privileges <span class="caret"></span>
		</button>
		<ul class="dropdown-menu" role="menu">
			<li role="presentation"><a href="#" data-priv="groups:find" class="<!-- IF groups.privileges.groups:find -->active<!-- ENDIF groups.privileges.groups:find -->">Find Category</a></li>
			<li role="presentation"><a href="#" data-priv="groups:read" class="<!-- IF groups.privileges.groups:read -->active<!-- ENDIF groups.privileges.groups:read -->">Access Category</a></li>
			<li role="presentation"><a href="#" data-priv="groups:topics:read" class="<!-- IF groups.privileges.groups:topics:read -->active<!-- ENDIF groups.privileges.groups:topics:read -->">Access Topics</a></li>
			<li role="presentation"><a href="#" data-priv="groups:topics:create" class="<!-- IF groups.privileges.groups:topics:create -->active<!-- ENDIF groups.privileges.groups:topics:create -->">Create Topics</a></li>
			<li role="presentation"><a href="#" data-priv="groups:topics:reply" class="<!-- IF groups.privileges.groups:topics:reply -->active<!-- ENDIF groups.privileges.groups:topics:reply -->">Reply to Topics</a></li>
			<li role="presentation"><a href="#" data-priv="groups:posts:edit" class="<!-- IF groups.privileges.groups:posts:edit -->active<!-- ENDIF groups.privileges.groups:posts:edit -->">Edit Posts</a></li>
			<li role="presentation"><a href="#" data-priv="groups:posts:delete" class="<!-- IF groups.privileges.groups:posts:delete -->active<!-- ENDIF groups.privileges.groups:posts:delete -->">Delete Posts</a></li>
			<li role="presentation"><a href="#" data-priv="groups:topics:delete" class="<!-- IF groups.privileges.groups:topics:delete -->active<!-- ENDIF groups.privileges.groups:topics:delete -->">Delete Topics</a></li>
		</ul>
	</div>
	{groups.displayName}
</li>
<!-- END groups -->

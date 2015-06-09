<!-- BEGIN users -->
<li data-uid="{users.uid}">
	<div class="btn-group pull-right">
		<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">
			Privileges <span class="caret"></span>
		</button>
		<ul class="dropdown-menu" role="menu">
			<li role="presentation"><a href="#" data-priv="find" class="<!-- IF users.privileges.find -->active<!-- ENDIF users.privileges.find -->">Find category</a></li>
			<li role="presentation"><a href="#" data-priv="read" class="<!-- IF users.privileges.read -->active<!-- ENDIF users.privileges.read -->">Access &amp; Read</a></li>
			<li role="presentation"><a href="#" data-priv="topics:create" class="<!-- IF users.privileges.topics:create -->active<!-- ENDIF users.privileges.topics:create -->">Create Topics</a></li>
			<li role="presentation"><a href="#" data-priv="topics:reply" class="<!-- IF users.privileges.topics:reply -->active<!-- ENDIF users.privileges.topics:reply -->">Reply to Topics</a></li>
			<li role="presentation" class="divider"></li>
			<li role="presentation"><a href="#" data-priv="mods" class="<!-- IF users.privileges.mods -->active<!-- ENDIF users.privileges.mods -->">Moderator</a></li>
		</ul>
	</div>
	<img src="{users.picture}" /> {users.username}
</li>
<!-- END users -->
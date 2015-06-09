<!-- BEGIN groups -->
<li data-name="{groups.name}">
	<div class="btn-group pull-right">
		<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">
			Privileges <span class="caret"></span>
		</button>
		<ul class="dropdown-menu" role="menu">
			<li role="presentation"><a href="#" data-priv="groups:find" class="<!-- IF groups.privileges.groups:find -->active<!-- ENDIF groups.privileges.groups:find -->">Find category</a></li>
			<li role="presentation"><a href="#" data-priv="groups:read" class="<!-- IF groups.privileges.groups:read -->active<!-- ENDIF groups.privileges.groups:read -->">Access &amp; Read</a></li>
			<li role="presentation"><a href="#" data-priv="groups:topics:create" class="<!-- IF groups.privileges.groups:topics:create -->active<!-- ENDIF groups.privileges.groups:topics:create -->">Create Topics</a></li>
			<li role="presentation"><a href="#" data-priv="groups:topics:reply" class="<!-- IF groups.privileges.groups:topics:reply -->active<!-- ENDIF groups.privileges.groups:topics:reply -->">Reply to Topics</a></li>
		</ul>
	</div>
	{groups.name}
</li>
<!-- END groups -->
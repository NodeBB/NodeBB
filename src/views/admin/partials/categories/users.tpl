<!-- BEGIN users -->
<li data-uid="{users.uid}">
	<div class="btn-group pull-right">
		<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">[[admin:partials.users.privileges]]<span class="caret"></span>
		</button>
		<ul class="dropdown-menu" role="menu">
			<li role="presentation"><a href="#" data-priv="find" class="<!-- IF users.privileges.find -->[[admin:partials.users.active]]<!-- ENDIF users.privileges.find -->">[[admin:partials.users.find_category]]</a></li>
			<li role="presentation"><a href="#" data-priv="read" class="<!-- IF users.privileges.read -->[[admin:partials.users.active]]<!-- ENDIF users.privileges.read -->">[[admin:partials.users.access_read]]</a></li>
			<li role="presentation"><a href="#" data-priv="topics:create" class="<!-- IF users.privileges.topics:create -->[[admin:partials.users.active]]<!-- ENDIF users.privileges.topics:create -->">[[admin:partials.users.create_topics]]</a></li>
			<li role="presentation"><a href="#" data-priv="topics:reply" class="<!-- IF users.privileges.topics:reply -->[[admin:partials.users.active]]<!-- ENDIF users.privileges.topics:reply -->">[[admin:partials.users.reply_to_topics]]</a></li>
			<li role="presentation" class="divider"></li>
			<li role="presentation"><a href="#" data-priv="mods" class="<!-- IF users.privileges.mods -->[[admin:partials.users.active]]<!-- ENDIF users.privileges.mods -->">[[admin:partials.users.moderator]]</a></li>
		</ul>
	</div>
	<img src="{users.picture}" /> {users.username}
</li>
<!-- END users -->
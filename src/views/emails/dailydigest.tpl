<p>[[email:greeting_with_name, {username}]],</p>

<!-- IF notifications.length -->
<p>[[email:digest.notifications, {site_title}]]</p>

<ul>
	<!-- BEGIN notifications -->
	<li style="text-decoration: none; list-style-type: none; padding-bottom: 0.5em;">
		<a href="{url}{notifications.path}"><img style="vertical-align: middle; width: 16px; height: 16px; padding-right: 1em;" src="{notifications.image}" />{notifications.bodyShort}</a>
	</li>
	<!-- END notifications -->
</ul>

<hr />
<!-- ENDIF notifications.length -->

<p>[[email:digest.latest_topics, {site_title}]]</p>
<ul>
	<!-- IF recent.length -->
	<!-- BEGIN recent -->
	<li style="text-decoration: none; list-style-type: none; padding-bottom: 0.5em;">
		<a href="{url}/topic/{recent.slug}"><img style="vertical-align: middle; width: 16px; height: 16px; padding-right: 1em;" src="{recent.teaser.user.picture}" title="{recent.teaser.user.username}" />{recent.title}</a>
	</li>
	<!-- END recent -->
	<!-- ELSE -->
	<li style="text-decoration: none; list-style-type: none; padding-bottom: 0.5em; font-style: italic;">
		[[email:digest.daily.no_topics]]
	</li>
	<!-- ENDIF recent.length -->
</ul>

<p>
	<a href="{url}">[[email:digest.cta, {site_title}]]</a>
</p>

<p>
	[[email:closing]]<br />
	<strong>{site_title}</strong>
</p>

<hr />
<p>
	[[email:digest.unsub.info]] <a href="{url}/user/{username}/settings">[[email:unsub.cta]]</a>.
</p>
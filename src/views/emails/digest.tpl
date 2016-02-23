<p>[[email:greeting_with_name, {username}]],</p>

<!-- IF notifications.length -->
<p>[[email:digest.notifications, {site_title}]]</p>

<ul>
	<!-- BEGIN notifications -->
	<li style="text-decoration: none; list-style-type: none; padding-bottom: 0.5em;">
		<a href="{url}{notifications.path}">
			<!-- IF notifications.image -->
			<img style="vertical-align: middle; width: 16px; height: 16px; padding-right: 1em;" src="{notifications.image}" />
			<!-- ELSE -->
			<div style="width: 16px; height: 16px; line-height: 16px; font-size: 10px; margin-right: 1em; background-color: {notifications.user.icon:bgColor}; color: white; text-align: center; display: inline-block;">{notifications.user.icon:text}</div>
			<!-- ENDIF notifications.image -->
			{notifications.bodyShort}
		</a>
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
		<a href="{url}/topic/{recent.slug}">
			{function.renderDigestAvatar}{recent.title}
		</a>
	</li>
	<!-- END recent -->
	<!-- ELSE -->
	<li style="text-decoration: none; list-style-type: none; padding-bottom: 0.5em; font-style: italic;">
		[[email:digest.no_topics, [[email:digest.{interval}]]]]
	</li>
	<!-- ENDIF recent.length -->
</ul>

<p>
	<a href="{url}">[[email:digest.cta, {site_title}]]</a>
</p>

<!-- IMPORT emails/partials/footer.tpl -->

<hr />
<p>
	[[email:digest.unsub.info]] <a href="{url}/user/{userslug}/settings">[[email:unsub.cta]]</a>.
</p>
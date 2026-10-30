<p>{{tx("admin/settings/activitypub:blocklists.view.intro", count)}}</p>
<ol>
	{{{ each domains }}}
	<li><code>{@value}</code></li>
	{{{ end }}}
</ol>

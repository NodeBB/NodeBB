{{{ if !error }}}
<div class="alert alert-success">
	<strong>{{tx("global:alert.success")}}</strong>
	<p>{{tx("email:unsub.success", payload.template)}}</p>
{{{ else }}}
<div class="alert alert-warning">
	<strong>{{tx("email:unsub.failure.title")}}</strong>
	<p>{{tx("email:unsub.failure.message", error, concat(config.relative_path, "/me/settings"))}}</p>
{{{ end }}}
	<hr />

	<p>
		<a href="{config.relative_path}/">{{tx("notifications:back-to-home", config.siteTitle)}}</a>
	</p>
</div>
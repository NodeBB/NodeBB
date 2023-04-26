{{{ if !error }}}
<div class="alert alert-success">
	<strong>[[global:alert.success]]</strong>
	<p>[[email:unsub.success, {payload.template}]]</p>
{{{ else }}}
<div class="alert alert-warning">
	<strong>[[email:unsub.failure.title]]</strong>
	<p>[[email:unsub.failure.message, {error}, {config.relative_path}/me/settings]]</p>
{{{ end }}}
	<hr />

	<p>
		<a href="{config.relative_path}/">[[notifications:back_to_home, {config.siteTitle}]]</a>
	</p>
</div>
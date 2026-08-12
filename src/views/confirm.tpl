{{{ if error }}}
<div class="alert alert-warning">
	<p>{{tx("notifications:email-confirm-error-message")}}</p>
{{{ end }}}

{{{ if !error }}}
<div class="alert alert-success">
	<strong>{{tx("notifications:email-confirmed")}}</strong>
	<p>{{tx("notifications:email-confirmed-message")}}</p>
{{{ end }}}
	<p class="mb-0">
		<a href="{config.relative_path}/">{{tx("notifications:back-to-home", config.siteTitle)}}</a>
	</p>
</div>
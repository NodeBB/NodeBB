{{{ if alreadyValidated }}}
<div class="alert alert-info">
	<p>[[notifications:email-confirm-error-message-already-validated]]</p>
{{{ end }}}

{{{ if error }}}
<div class="alert alert-warning">
	<p>[[notifications:email-confirm-error-message]]</p>
{{{ end }}}

{{{ if (!error && !alreadyValidated )}}}
<div class="alert alert-success">
	<strong>[[notifications:email-confirmed]]</strong>
	<p>[[notifications:email-confirmed-message]]</p>
{{{ end }}}
	<p class="mb-0">
		<a href="{config.relative_path}/">[[notifications:back-to-home, {config.siteTitle}]]</a>
	</p>
</div>
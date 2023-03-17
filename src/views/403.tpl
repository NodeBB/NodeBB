<div class="alert alert-danger">
	<strong>[[global:403.title]]</strong>

	<p>{{{ if error }}}{error}{{{ else }}}[[global:403.message]]{{{ end }}}</p>

	{{{ if returnLink }}}
	<p>[[error:goback]]</p>
	{{{ end }}}

	{{{ if !loggedIn }}}
	<p>[[global:403.login, {config.relative_path}]]</p>
	{{{ end }}}
</div>
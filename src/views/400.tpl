<div class="alert alert-danger">
	<strong>[[global:400.title]]</strong>

	<p>{{{ if error }}}{error}{{{ else }}}[[global:400.message, {config.relative_path}]]{{{ end }}}</p>

	{{{ if returnLink }}}
	<p>[[error:goback]]</p>
	{{{ end }}}
</div>

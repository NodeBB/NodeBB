<div component="settings/main/header" class="row border-bottom py-2 m-0 mb-3 sticky-top acp-page-main-header align-items-center">
	<div class="col-12 col-md-8 px-0 mb-1 mb-md-0">
		<h4 class="fw-bold tracking-tight mb-0">{title}</h4>
	</div>
</div>

<p class="lead">[[admin/settings/activitypub:errors.intro, {errors.length}]]</p>

<div class="row flex-column-reverse flex-md-row">
	<div class="col-12 col-md-4" id="errors">
		{{{ each errors }}}
		<details class="mb-3" data-index="{@index}">
			<summary>
				<span title="{./timestampISO}" class="timeago text-secondary text-sm"></span>
				<span class="badge text-bg-primary">{{{ if (./type == "in") }}}IN{{{ else }}}OUT{{{ end }}}</span>
				<span class="badge text-bg-secondary">{./activityType}</span>
				<br/ >
				<code>{./id}</code>
			</summary>

			{{{ if ./stack }}}
			<pre class="m-2 border p-2"><code>{./stack}</code></pre>
			{{{ end }}}
		</details>
		{{{ end }}}
	</div>
	<div class="col-12 col-md-8">
		<pre class="m-2 p-2 border"><code id="payload"></code></pre>
	</div>
</div>

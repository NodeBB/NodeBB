<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div class="mb-4">
				<p class="lead">[[admin/settings/activitypub:errors.intro]]</p>
				{{{ each errors }}}
				<details class="mb-3">
					<summary>{./id}</summary>

					{{{ if ./stack }}}
					<pre class="m-2 border p-2"><code>{./stack}</code></pre>
					{{{ end }}}

					{{{ if ./body }}}
					<pre class="m-2 border p-2"><code>{./body}</code></pre>
					{{{ else }}}
					<em>[[admin/settings/activitypub:errors.payload-gone]]</em>
					{{{ end }}}
				</details>
				{{{ end }}}
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>

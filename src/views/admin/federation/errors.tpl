<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div class="mb-4">
				<p class="lead">[[admin/settings/activitypub:errors.intro]]</p>
				{{{ each errors }}}
				<details>
					<summary>{./id}</summary>
					<pre class="m-2 border p-2"><code>{./payload}</code></pre>
				</details>
				{{{ end }}}
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>

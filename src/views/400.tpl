<div class="flex-fill">
	<h2 class="fw-semibold tracking-tight text-center">[[global:400.title]]</h2>

	<div class="mx-auto">
		<div class="d-flex flex-column gap-3 justify-content-center text-center">
			<div class="mx-auto p-4 bg-light border rounded">
				<i class="text-secondary fa fa-fw fa-4x fa-triangle-exclamation"></i>
			</div>
			{{{ if error }}}{error}{{{ else }}}[[global:400.message, {config.relative_path}]]{{{ end }}}
		</div>
	</div>
</div>

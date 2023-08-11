<div class="hooks-list panel-group px-lg-4" id="accordion" role="tablist" aria-multiselectable="true">
	{{{ each hooks }}}
	<div class="card">
		<div class="card-header" role="tab">
			<h6 class="mb-0">
				<a style="text-transform: none;" class="text-reset text-decoration-none" role="button" data-bs-toggle="collapse" data-bs-parent="#accordion" data-bs-target="#{hooks.index}" aria-expanded="true" aria-controls="{hooks.index}">{hooks.hookName}</a>
				<span class="float-end">{hooks.count} hooks</span>
			</h6>
		</div>
		<div id="{hooks.index}" class="accordion-collapse collapse" role="tabpanel">
		<div class="card-body">
			{{{ each hooks.methods }}}
			<div class="mb-3">
				<strong>{hooks.methods.id}</strong>
				Priority: {hooks.methods.priority}

				<button class="btn btn-primary btn-sm float-end" type="button" data-bs-toggle="collapse" data-bs-target="#{hooks.methods.index}" aria-expanded="false" aria-controls="{hooks.methods.index}">
					Show Code <i class="fa fa-eye"></i>
				</button>
			</div>
			<div class="collapse" id="{hooks.methods.index}">
				<pre class="p-3 text-bg-light border border-secondary rounded">{hooks.methods.method}</pre>
			</div>
			{{{ end }}}
		</div>
		</div>
	</div>
	{{{ end }}}
</div>
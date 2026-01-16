<div class="hooks-list px-lg-4" id="accordion" role="tablist" aria-multiselectable="true">
	{{{ each hooks }}}
	<div class="mb-3 border rounded p-2">
		<div class="" role="tab">
			<h6 class="mb-0 d-flex align-items-center">
				<button class="btn btn-ghost btn-sm" data-bs-toggle="collapse" data-bs-parent="#accordion" data-bs-target="#{hooks.index}" aria-expanded="true" aria-controls="{hooks.index}">{hooks.hookName} ({hooks.count})</button>
			</h6>
		</div>
		<div id="{hooks.index}" class="accordion-collapse collapse" role="tabpanel">
			<div class="d-flex flex-column mt-3 ms-3">
				{{{ each hooks.methods }}}
				<div class="mb-3">
					<span>{hooks.methods.id}</span>
					<span class="text-secondary text-sm">Priority: {hooks.methods.priority}</span>

					<button class="btn btn-light btn-sm float-end" type="button" data-bs-toggle="collapse" data-bs-target="#{hooks.methods.index}" aria-expanded="false" aria-controls="{hooks.methods.index}">
						<i class="fa fa-eye"></i> Show Code
					</button>
				</div>
				<div class="collapse" id="{hooks.methods.index}">
					<pre class="p-3 text-bg-light border rounded">{hooks.methods.method}</pre>
				</div>
				{{{ end }}}
			</div>
		</div>
	</div>
	{{{ end }}}
</div>
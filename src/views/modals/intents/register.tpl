<div class="modal-intents-register">
	<p class="text-muted">{{{ if description }}}{description}{{{ end }}}</p>

	<form id="intents-register-form" class="mt-3">
		<div class="mb-3">
			<label class="form-label" for="intents-handle-input">[[intents:handle-label]]</label>
			<input
				id="intents-handle-input"
				type="text"
				class="form-control"
				placeholder="[[intents:handle-placeholder]]"
				autocomplete="off"
			/>
		</div>

		<button type="submit" class="btn btn-primary" id="intents-register-btn" disabled>
			[[intents:register-button]]
		</button>
	</form>

	{{{ if (handles && handles.length) }}}
	<hr />
	<h6 class="mt-3">[[intents:registered-handles]]</h6>
	<ul class="list-group list-group-flush" id="intents-registered-list">
		{{{ each handles }}}
		<li class="list-group-item d-flex justify-content-between align-items-center">
			<div>
				<strong>{./handle}</strong>
				{{{ if ./intents }}}<small class="text-muted ms-2">({./intents})</small>{{{ end }}}
			</div>
			<button type="button" class="btn btn-sm btn-outline-danger" data-action="remove" data-handle="{./handle}">
				<i class="fa fa-times"></i>
			</button>
		</li>
		{{{ end }}}
	</ul>
	{{{ end }}}

	{{{ if (!handles || !handles.length) }}}
	<p class="text-muted mt-3">[[intents:no-handles]]</p>
	{{{ end }}}
</div>

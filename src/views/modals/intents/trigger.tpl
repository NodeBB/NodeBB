<div class="modal-intents-trigger">
	<button type="button" class="btn btn-primary text-capitalize w-100" data-action="go-login">
		<i class="fa fa-sign-in-alt"></i> {{tx("global:login")}}
	</button>

	<hr />

	<p>{{tx("intents:trigger-description")}}</p>

	{{{ if (matchingHandles && matchingHandles.length) }}}
	<hr />
	<h6 class="mt-3">{{tx("intents:trigger-your-handles")}}</h6>
	<ul class="list-group list-group-flush" id="intents-trigger-list">
		{{{ each matchingHandles }}}
		<li class="list-group-item d-flex justify-content-between align-items-center">
			<div>
				<strong>{./handle}</strong>
				{{{ if ./intents }}}<small class="text-muted ms-2">({./intents})</small>{{{ end }}}
			</div>
			<button type="button" class="btn btn-sm btn-outline-primary" data-action="execute-intent" data-handle="{./handle}">
				<i class="fa fa-check"></i> {{tx("intents:trigger-yes")}}
			</button>
		</li>
		{{{ end }}}
	</ul>
	{{{ end }}}

	{{{ if (hasAnyHandles && (!matchingHandles || !matchingHandles.length)) }}}
	<hr />
	<p class="text-muted mt-3 text-sm">{{tx("intents:trigger-no-matching")}}</p>
	{{{ end }}}

	<hr />
	<div class="d-flex gap-2 mt-3">
		<button type="button" class="btn btn-link" data-action="open-register">
			<i class="fa fa-share-alt"></i> {{tx("login:manage-social-web-handles")}}
		</button>
	</div>
</div>

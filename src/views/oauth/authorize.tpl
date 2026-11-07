<div class="row">
	<div class="col-12 col-lg-8 col-xl-6 mx-auto">
		<div class="card shadow-sm">
			<div class="card-body p-4">
				<h3 class="tracking-tight fw-semibold mb-3">{{tx("oauth:authorize.title")}}</h3>

				<p class="mb-3">{{tx("oauth:authorize.intro", ./client.name)}}</p>

				<div class="alert alert-light border mb-3">
					<strong>{{tx("oauth:authorize.client")}}</strong>
					<div>{./client.name}</div>
					{{{ if ./client.description }}}
					<div class="text-secondary small">{./client.description}</div>
					{{{ end }}}
					<div class="text-secondary small mt-1"><code>{./client.id}</code></div>
				</div>

				{{{ if scopes.length }}}
				<h6 class="text-uppercase text-secondary small">{{tx("oauth:authorize.permissions")}}</h6>
				<ul class="list-unstyled mb-3">
					{{{ each scopes }}}
					<li class="mb-1">
						<strong>{./name}</strong>
						<div class="text-secondary small">{./description}</div>
					</li>
					{{{ end }}}
				</ul>
				{{{ else }}}
				<p class="text-secondary">{{tx("oauth:authorize.no-scopes")}}</p>
				{{{ end }}}

				{{{ if ./codeChallenge }}}
				<p class="text-secondary small mb-3">
					<i class="fa fa-shield-halved"></i> {{tx("oauth:authorize.pkce")}}
				</p>
				{{{ end }}}

				<div class="d-flex gap-2">
					<form method="post" action="{config.relative_path}/oauth/authorize" class="m-0">
						<input type="hidden" name="transaction_id" value="{./transactionID}" />
						<input type="hidden" name="_csrf" value="{config.csrf_token}" />
						<button type="submit" class="btn btn-primary">{{tx("oauth:authorize.allow")}}</button>
					</form>
					<form method="post" action="{config.relative_path}/oauth/authorize" class="m-0">
						<input type="hidden" name="transaction_id" value="{./transactionID}" />
						<input type="hidden" name="_csrf" value="{config.csrf_token}" />
						<input type="hidden" name="cancel" value="1" />
						<button type="submit" class="btn btn-outline-secondary">{{tx("oauth:authorize.deny")}}</button>
					</form>
				</div>
			</div>
		</div>
	</div>
</div>

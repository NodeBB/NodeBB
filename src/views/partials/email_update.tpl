<div>
	{{{ if hasPending }}}
	<div class="alert alert-info">
		<p>{{tx("user:emailUpdate.pending")}}</p>
	</div>
	{{{ end }}}
	<p>{{tx("user:emailUpdate.intro")}}</p>
	{{{ if requireEmailAddress }}}
	<p>{{tx("user:emailUpdate.required")}}</p>
	{{{ else }}}
	<p>{{tx("user:emailUpdate.optional")}}</p>
	{{{ end }}}
	<div class="mb-3">
		<label class="form-label" for="email">{{tx("global:email")}}</label>
		<input class="form-control" type="text" id="email" name="email" placeholder="{email}" value="{email}" />
		<p class="form-text">{{tx("user:emailUpdate.change-instructions")}}</p>
	</div>

	{{{ if issuePasswordChallenge }}}
	<div class="mb-3">
		<label class="form-label" for="password">{{tx("register:password")}}</label>
		<input class="form-control" type="password" id="password" name="password" />
		<p class="form-text">{{tx("user:emailUpdate.password-challenge")}}</p>
	</div>
	{{{ end }}}
</div>
<div>
	{{{ if hasPending }}}
	<div class="alert alert-info">
		<p>[[user:emailUpdate.pending]]</p>
	</div>
	{{{ end }}}
	<p>[[user:emailUpdate.intro]]</p>
	{{{ if requireEmailAddress }}}
	<p>[[user:emailUpdate.required]]</p>
	{{{ else }}}
	<p>[[user:emailUpdate.optional]]</p>
	{{{ end }}}
	<div class="mb-3">
		<label class="form-label" for="email">[[global:email]]</label>
		<input class="form-control" type="text" id="email" name="email" placeholder="{email}" value="{email}" />
		<p class="form-text">[[user:emailUpdate.change-instructions]]</p>
	</div>

	{{{ if issuePasswordChallenge }}}
	<div class="mb-3">
		<label class="form-label" for="password">[[register:password]]</label>
		<input class="form-control" type="password" id="password" name="password" />
		<p class="form-text">[[user:emailUpdate.password-challenge]]</p>
	</div>
	{{{ end }}}
</div>
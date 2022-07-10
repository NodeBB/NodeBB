<div class="form-group">
	<p>[[user:emailUpdate.intro]]</p>
	{{{ if requireEmailAddress }}}
	<p>[[user:emailUpdate.required]]</p>
	{{{ else }}}
	<p>[[user:emailUpdate.optional]]</p>
	{{{ end }}}
	<div class="form-group">
		<label for="email">[[global:email]]</label>
		<input class="form-control" type="text" id="email" name="email" placeholder="{email}" value="{email}" />
	</div>
	<p class="help-block">[[user:emailUpdate.change-instructions]]</p>
</div>
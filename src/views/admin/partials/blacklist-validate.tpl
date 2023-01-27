<p class="lead">
	[[ip-blacklist:validate.x-valid, {valid.length}, {numRules}]]
</p>

{{{ if invalid.length }}}
<p>
	[[ip-blacklist:validate.x-invalid, {invalid.length}]]
</p>
<ul>
	{{{ each invalid }}}
	<li><code>{@value}</code></li>
	{{{ end }}}
</ul>
{{{ end }}}
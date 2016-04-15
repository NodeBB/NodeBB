<p class="lead">
	<strong>{valid.length}</strong> out of <strong>{numRules}</strong> rule(s) valid.
</p>

<!-- IF invalid.length -->
<p>
	The following <strong>{invalid.length}</strong> rules are invalid:
</p>
<ul>
	<!-- BEGIN invalid -->
	<li><code>@value</code></li>
	<!-- END invalid -->
</ul>
<!-- ENDIF invalid.length -->
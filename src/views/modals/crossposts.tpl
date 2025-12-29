<div class="mb-3">
	{{{ if crossposts.length }}}
		<p>[[topic:crossposts.listing]]</p>
		{{{ each crossposts }}}
		{buildCategoryLabel(./category, "a", "border")}
		{{{ end }}}
	{{{ else }}}
		<p>[[topic:crossposts.none]]</p>
	{{{ end }}}
</div>

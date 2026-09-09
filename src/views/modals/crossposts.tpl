<div class="mb-3">
	{{{ if crossposts.length }}}
		<p>{{tx("topic:crossposts.listing")}}</p>
		{{{ each crossposts }}}
		{{buildCategoryLabel(./category, "a", "border")}}
		{{{ end }}}
	{{{ else }}}
		<p>{{tx("topic:crossposts.none")}}</p>
	{{{ end }}}
</div>

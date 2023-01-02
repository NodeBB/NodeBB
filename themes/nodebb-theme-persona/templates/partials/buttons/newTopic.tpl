<noscript><div class="dropdown" component="category-selector"></noscript>
<label component="category/post" for="category-dropdown-check" class="btn btn-primary" id="new_topic" role="button">
	[[category:new_topic_button]]
</label>
<noscript>
	<input type="checkbox" class="hidden" id="category-dropdown-check" aria-hidden="true">
	<ul component="category/list" class="dropdown-menu category-dropdown-menu" role="menu">
		{{{each categories}}}
		<li role="presentation" class="category {{{if categories.disabledClass}}}disabled{{{end}}}">
			<a role="menu-item" href="{config.relative_path}/compose?cid={categories.cid}">{categories.level}<span component="category-markup">{{{if categories.icon}}}<span class="fa-stack" style="{function.generateCategoryBackground}"><i style="color: {categories.color};" class="fa fa-stack-1x fa-fw {categories.icon}"></i></span>{{{end}}} {categories.name}</span></a>
		</li>
		{{{end}}}
	</ul>
</div>
</noscript>

{{{ if children.length }}}
<div class="subcategory">
	{{{ if hasMoreSubCategories }}}
	<div><!-- IMPORT partials/category-selector.tpl --></div>
	{{{ else }}}
	<p>[[category:subcategories]]</p>
	{{{ end }}}

	<ul component="category/subcategory/container" class="categories" itemscope itemtype="http://www.schema.org/ItemList">
		{{{each children}}}
		<!-- IMPORT partials/categories/item.tpl -->
		{{{end}}}
	</ul>
	{{{ if hasMoreSubCategories}}}
	<button class="btn btn-default" component="category/load-more-subcategories">[[category:x-more-categories, {subCategoriesLeft}]]</button>
	{{{ end }}}
</div>
{{{ end }}}
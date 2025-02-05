<button type="button" class="btn btn-ghost btn-sm dropdown-toggle" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
	<span component="category-selector-selected">
		<span class="category-item d-inline-flex align-items-center gap-1">
		{{{ if (selectedCategory && !showCategorySelectLabel) }}}
			{buildCategoryIcon(selectedCategory, "24px", "rounded-circle")}
			{selectedCategory.name}
		{{{ else }}}
		<i class="fa fa-fw {{{ if selectCategoryIcon }}}{selectCategoryIcon}{{{ else }}}fa-list{{{ end }}}"></i>
		{{{ if selectCategoryLabel }}}{selectCategoryLabel}{{{ else }}}[[topic:thread-tools.select-category]]{{{ end }}}
		{{{ end }}}
		</span>
	</span> <span class="caret"></span>
</button>

<div class="dropdown-menu p-1">
	<div component="category-selector-search" class="p-1 hidden">
		<input type="text" class="form-control form-control-sm" placeholder="[[search:type-to-search]]" autocomplete="off">
		<hr class="mt-2 mb-0"/>
	</div>

	<ul component="category/list" class="list-unstyled mb-0 text-sm category-dropdown-menu" role="menu">
		<li component="category/no-matches" role="presentation" class="category hidden">
			<a class="dropdown-item rounded-1" role="menu-item">[[search:no-matches]]</a>
		</li>
		{{{each categoryItems}}}
		<li role="presentation" class="category {{{ if ./disabledClass }}}disabled {{{ end }}}" data-cid="{./cid}" data-name="{./name}" data-parent-cid="{./parentCid}">
			<a href="#" class="dropdown-item rounded-1" role="menu-item">{./level}
				<span component="category-markup" style="{{{ if ./match }}}font-weight: bold;{{{end}}}">
					<div class="category-item d-inline-flex align-items-center gap-1">
						{{{ if ./icon }}}
						{buildCategoryIcon(@value, "24px", "rounded-circle")}
						{{{ end }}}
						{./name}
					</div>
				</span>
			</a>
		</li>
		{{{ end }}}
	</ul>
</div>
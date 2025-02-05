<div class="mb-3">
	<div component="category-selector" class="btn-group">
		<button type="button" class="btn btn-ghost border dropdown-toggle" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
			<span component="category-selector-selected">[[topic:thread-tools.select-category]]</span> <span class="caret"></span>
		</button>

		<div class="dropdown-menu p-1">
			<div component="category-selector-search" class="p-1 hidden">
				<input type="text" class="form-control form-control-sm" placeholder="[[search:type-to-search]]" autocomplete="off">
				<hr class="mt-2 mb-0"/>
			</div>
			<ul component="category/list" class="list-unstyled mb-0 text-sm category-dropdown-menu ghost-scrollbar" role="menu">
				<li component="category/no-matches" role="presentation" class="category hidden">
					<a class="dropdown-item rounded-1" role="menuitem">[[search:no-matches]]</a>
				</li>
				{{{ each categories }}}
				<li role="presentation" class="category {{{if categories.disabledClass}}}disabled{{{end}}}" data-cid="{categories.cid}" data-name="{categories.name}">
					<a class="dropdown-item rounded-1" role="menuitem">{categories.level}
						<span component="category-markup">
							<div class="category-item d-inline-block">
								{buildCategoryIcon(@value, "24px", "rounded-circle")}
								{./name}
							</div>
						</span>
					</a>
				</li>
				{{{ end }}}
			</ul>
		</div>
	</div>
</div>

{{{ if message }}}
<div>{message}</div>
{{{ end }}}
<button type="button" class="btn btn-ghost btn-sm ff-secondary d-flex align-items-center gap-2 dropdown-toggle h-100" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
    <span component="category-selector-selected" class="fw-semibold">
        {{{ if (selectedCategory && !showCategorySelectLabel) }}}
        <span class="category-item d-inline-flex align-items-center gap-1">
            {buildCategoryIcon(selectedCategory, "24px", "rounded-circle")}
            <span class="category-name">{selectedCategory.name}</span>
        </span>
        {{{ else }}}
        <i class="fa fa-fw {{{ if selectCategoryIcon }}}{selectCategoryIcon}{{{ else }}}fa-list{{{ end }}} text-primary"></i>
        <span class="d-none d-md-inline">{{{ if selectCategoryLabel }}}{selectCategoryLabel}{{{ else }}}[[topic:thread-tools.select-category]]{{{ end }}}</span>
        {{{ end }}}
    </span>
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
        {{{ each categoryItems }}}
        <li role="presentation" class="category {{{ if ./disabledClass }}}disabled {{{ end }}}" data-cid="{./cid}" data-name="{./name}" data-parent-cid="{./parentCid}">
            <a class="dropdown-item rounded-1 {{{ if ./disabledClass }}}disabled{{{ end }}}" role="menuitem" href="#">{./level}
                <span component="category-markup" style="{{{ if ./match }}}font-weight: bold;{{{end}}}">
                    <span class="category-item d-inline-flex align-items-center gap-1">
                        {{{ if ./icon }}}
                        {buildCategoryIcon(@value, "24px", "rounded-circle")}
                        {{{ end }}}
                        <span class="category-name">{./name}</span>
                    </span>
                </span>
            </a>
        </li>
        {{{ end }}}
    </ul>
</div>
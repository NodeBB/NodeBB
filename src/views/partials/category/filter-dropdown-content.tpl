<button type="button" class="btn btn-ghost btn-sm d-flex align-items-center ff-secondary d-flex gap-2 dropdown-toggle" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
    {{{ if selectedCategory }}}
    <span class="category-item d-inline-flex align-items-center gap-1">
        {buildCategoryIcon(selectedCategory, "18px", "rounded-circle")}
        <span class="d-none d-md-inline fw-semibold">{selectedCategory.name}</span>
    </span>
    {{{ else }}}
    <i class="fa fa-fw fa-list text-primary"></i>
    <span class="d-none d-md-inline fw-semibold">[[unread:all-categories]]</span>{{{ end }}}
</button>

<div component="category-selector-search" class="hidden position-absolute" style="min-width: 120px;">
    <input type="text" class="form-control form-control-sm" placeholder="[[search:type-to-search]]" autocomplete="off">
</div>

<div class="dropdown-menu p-1">
    <ul component="category/list" class="list-unstyled mb-0 text-sm category-dropdown-menu ghost-scrollbar" role="menu">
        <li role="presentation" class="category" data-cid="all">
            <a class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem" href="{{{ if allCategoriesUrl }}}{config.relative_path}/{allCategoriesUrl}{{{ else }}}#{{{ end }}}">
                <div class="flex-grow-1">[[unread:all-categories]]</div>
                <i component="category/select/icon" class="flex-shrink-0 fa fa-fw fa-check {{{if selectedCategory}}}invisible{{{end}}}"></i>
            </a>
        </li>
        {{{each categoryItems}}}
        <li role="presentation" class="category {{{ if ./disabledClass }}}disabled{{{ end }}}" data-cid="{./cid}" data-parent-cid="{./parentCid}" data-name="{./name}">
            <a class="dropdown-item rounded-1 d-flex align-items-center gap-2 {{{ if ./disabledClass }}}disabled{{{ end }}}" role="menuitem" href="#">
                {./level}
                <span component="category-markup" class="flex-grow-1" style="{{{ if ./match }}}font-weight: bold;{{{end}}}">
                    <div class="category-item d-inline-flex align-items-center gap-1">
                        {{{ if ./icon }}}
                        {buildCategoryIcon(@value, "24px", "rounded-circle")}
                        {{{ end }}}
                        {./name}
                    </div>
                </span>
                <i component="category/select/icon" class="flex-shrink-0 fa fa-fw fa-check {{{ if !./selected }}}invisible{{{ end }}}"></i>
            </a>
        </li>
        {{{end}}}
    </ul>
</div>
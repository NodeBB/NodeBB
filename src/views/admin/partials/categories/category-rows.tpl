<ul data-cid="{cid}">
{{{ each categories }}}
    <li data-cid="{categories.cid}" data-parent-cid="{categories.parentCid}" data-name="{categories.name}" {{{ if categories.disabled }}}class="disabled"{{{ end }}}>
        <div class="row category-row">
            <div class="col-md-9">
                <div class="clearfix">
                    <div class="toggle">
                        <i class="fa fa-chevron-down"></i>
                    </div>
                    <div class="information">
                        <div class="float-start me-1">
                        {buildCategoryIcon(@value, "24px", "rounded-circle")}
                        </div>
                        <h5 class="category-header"><a href="{config.relative_path}/admin/manage/categories/{categories.cid}">{categories.name}</a> {{{ if categories.link }}}<small><a class="text-muted" href="{categories.link}"><i class="fa fa-link"></i> {categories.link}</a></small>{{{ end }}}</h5>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="clearfix float-end text-end">
                    <div class="btn-group category-tools">
                        <button class="btn btn-outline-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown" type="button"><i class="fa fa-fw fa-ellipsis-h"></i></button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item" href="./categories/{categories.cid}">[[admin/manage/categories:edit]]</a></li>
                            <li><a class="dropdown-item" href="./categories/{categories.cid}/analytics">[[admin/manage/categories:analytics]]</a></li>
                            <li><a class="dropdown-item" href="{config.relative_path}/admin/manage/privileges/{categories.cid}">[[admin/manage/categories:privileges]]</a></li>

                            <li><a class="dropdown-item" href="{{{if categories.link}}}{categories.link}{{{else}}}{config.relative_path}/category/{categories.cid}{{{end}}}" target="_blank">[[admin/manage/categories:view-category]]</a></li>

                            <li>
                                <a href="#" class="set-order dropdown-item" data-cid="{categories.cid}" data-order="{categories.order}">[[admin/manage/categories:set-order]]</a>
                            </li>
                            <li class="dropdown-divider"></li>
                            <li>
                                <a class="dropdown-item" href="#" data-disable-cid="{categories.cid}" data-action="toggle" data-disabled="{categories.disabled}">
                                {{{if categories.disabled}}}
                                [[admin/manage/categories:enable]]
                                {{{else}}}
                                [[admin/manage/categories:disable]]
                                {{{end}}}
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        <ul class="list-unstyled has-more-categories {{{ if !../hasMoreSubCategories}}}hidden{{{ end }}}">
            <li>
                <a href="{config.relative_path}/admin/manage/categories?cid={categories.cid}&page={categories.showMorePage}" class="btn btn-outline-secondary">[[category:x-more-categories, {../subCategoriesLeft}]]</a>
            </li>
        </ul>
    </li>
{{{ end }}}
</ul>

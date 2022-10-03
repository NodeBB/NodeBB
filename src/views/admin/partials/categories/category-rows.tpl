<ul data-cid="{cid}">
{{{ each categories }}}
    <li data-cid="{categories.cid}" data-parent-cid="{categories.parentCid}" data-name="{categories.name}" <!-- IF categories.disabled -->class="disabled"<!-- ENDIF categories.disabled -->>
        <div class="row category-row">
            <div class="col-md-9">
                <div class="clearfix">
                    <div class="toggle">
                        <i class="fa fa-chevron-down"></i>
                    </div>
                    <div class="information">
                        <div class="icon" style="
                            color: {categories.color};
                            background-color: {categories.bgColor};
                            <!-- IF categories.backgroundImage -->
                            background-image: url('{categories.backgroundImage}');
                            <!-- ENDIF categories.backgroundImage -->
                        ">
                            <i data-name="icon" value="{categories.icon}" class="fa {categories.icon}"></i>
                        </div>
                        <h5 class="category-header"><a href="{config.relative_path}/admin/manage/categories/{categories.cid}">{categories.name}</a> {{{ if categories.link }}}<small><a class="text-muted" href="{categories.link}"><i class="fa fa-link"></i> {categories.link}</a></small>{{{ end }}}</h5>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="clearfix pull-right text-right">
                    <div class="btn-group category-tools">
                        <button class="btn btn-default btn-xs dropdown-toggle" data-toggle="dropdown" type="button"><i class="fa fa-fw fa-ellipsis-h"></i></button>
                        <ul class="dropdown-menu dropdown-menu-right">
                            <li><a href="./categories/{categories.cid}">[[admin/manage/categories:edit]]</a></li>
                            <li><a href="./categories/{categories.cid}/analytics">[[admin/manage/categories:analytics]]</a></li>
                            <li><a href="{config.relative_path}/admin/manage/privileges/{categories.cid}">[[admin/manage/categories:privileges]]</a></li>

                            <li><a href="{{{if categories.link}}}{categories.link}{{{else}}}{config.relative_path}/category/{categories.cid}{{{end}}}" target="_blank">[[admin/manage/categories:view-category]]</a></li>

                            <li>
                                <a href="#" data-disable-cid="{categories.cid}" data-action="toggle" data-disabled="{categories.disabled}">
                                {{{if categories.disabled}}}
                                [[admin/manage/categories:enable]]
                                {{{else}}}
                                [[admin/manage/categories:disable]]
                                {{{end}}}
                                </a>
                            </li>
                            <li>
                                <a href="#" class="set-order" data-cid="{categories.cid}" data-order="{categories.order}">[[admin/manage/categories:set-order]]</a>
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

<ul data-cid="{cid}">
<!-- BEGIN categories -->
    <li data-cid="{categories.cid}" data-parent-cid="{categories.parentCid}" data-name="{categories.name}" <!-- IF categories.disabled -->class="disabled"<!-- ENDIF categories.disabled -->>
        <div class="row category-row">
            <div class="col-md-9">
                <div class="clearfix">
                    <div class="toggle">
                        <i class="fa fa-minus"></i>
                    </div>
                    <div class="icon" style="
                        color: {categories.color};
                        background-color: {categories.bgColor};
                        <!-- IF categories.backgroundImage -->
                        background-image: url('{categories.backgroundImage}');
                        <!-- ENDIF categories.backgroundImage -->
                    ">
                        <i data-name="icon" value="{categories.icon}" class="fa {categories.icon}"></i>
                    </div>
                    <div class="information">
                        <h5 class="category-header">{categories.name}</h5>
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

                            <li><a href="{config.relative_path}/category/{categories.cid}">[[admin/manage/categories:view-category]]</a></li>

                            <li>
                                <a href="#" data-disable-cid="{categories.cid}" data-action="toggle" data-disabled="{categories.disabled}">
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
    </li>
<!-- END categories -->
<li class="children-placeholder"></li>
</ul>

{{{ each users }}}
<div data-uid="{users.uid}">
    <h5>{./username}</h5>
    <div class="group-area">
        {{{ each ./groups }}}
        <div class="group-card float-start m-1" data-group-name="{./name}">
            <a href="{config.relative_path}/admin/manage/groups/{./slug}"><span class="badge p-2" style="color:{./textColor}; background-color: {./labelColor};">{{{ if ./icon }}}<i class="fa {./icon}"></i> {{{ end }}}{./name} <i class="ms-2 remove-group-icon fa fa-times" role="button"></i></span></a>
        </div>
        {{{ end }}}
    </div>
    <input data-uid="{./uid}" class="form-control group-search" placeholder="[[admin/manage/users:add-group]]" />
</div>
{{{ end }}}
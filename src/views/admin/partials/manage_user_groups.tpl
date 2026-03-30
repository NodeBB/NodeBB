{{{ each users }}}
<div data-uid="{users.uid}">
    <h5>{users.username}</h5>
    <div class="group-area">
        {{{ each users.groups }}}
        <div class="group-card float-start m-1" data-group-name="{users.groups.nameEscaped}">
            <a href="{config.relative_path}/admin/manage/groups/{users.groups.slug}"><span class="badge p-2" style="color:{users.groups.textColor}; background-color: {users.groups.labelColor};">{{{ if users.groups.icon }}}<i class="fa {users.groups.icon}"></i> {{{ end }}}{users.groups.displayName} <i class="ms-2 remove-group-icon fa fa-times" role="button"></i></span></a>
        </div>
        {{{ end }}}
    </div>
    <input data-uid="{users.uid}" class="form-control group-search" placeholder="[[admin/manage/users:add-group]]" />
</div>
{{{ end }}}
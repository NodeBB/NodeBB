{{{ each users }}}
<div data-uid="{users.uid}">
    <h5>{users.username}</h5>
    <div class="group-area">
        {{{ each users.groups }}}
        <div class="group-card pull-left" data-group-name="{users.groups.nameEscaped}">
            <a href="{config.relative_path}/admin/manage/groups/{users.groups.nameEncoded}"><span class="label label-default" style="color:{users.groups.textColor}; background-color: {users.groups.labelColor};"><!-- IF users.groups.icon --><i class="fa {users.groups.icon}"></i> <!-- ENDIF users.groups.icon -->{users.groups.displayName} <i class="remove-group-icon fa fa-times" role="button"></i></span></a>
        </div>
        {{{ end }}}
    </div>
    <input data-uid="{users.uid}" class="form-control group-search" placeholder="[[admin/manage/users:add-group]]" />
</div>
{{{ end }}}
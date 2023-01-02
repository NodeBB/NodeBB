<div class="dropdown pull-right">
  <button class="close" data-toggle="dropdown" component="chat/controlsToggle"><i class="fa fa-gear"></i></button>
  <ul class="dropdown-menu dropdown-menu-right pull-right" component="chat/controls">
    <li class="dropdown-header">[[modules:chat.options]]</li>
    <li>
      <a href="#" data-action="members"><i class="fa fa-fw fa-cog"></i> [[modules:chat.manage-room]]</a>
    </li>
    <li>
      <a href="#" data-action="rename"><i class="fa fa-fw fa-edit"></i> [[modules:chat.rename-room]]</a>
    </li>
    <li>
      <a href="#" data-action="leave"><i class="fa fa-fw fa-sign-out"></i> [[modules:chat.leave]]</a>
    </li>
    <!-- IF users.length -->
    <li role="separator" class="divider"></li>
    <li class="dropdown-header">[[modules:chat.in-room]]</li>
    {{{each users}}}
    <li>
      <a href="{config.relative_path}/uid/{../uid}">{buildAvatar(users, "sm", true)} {../username}</a>
    </li>
    {{{end}}}
    <!-- END -->
  </ul>
</div>

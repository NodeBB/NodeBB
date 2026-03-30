{{{ if user.privileges.superadmin }}}
<button component="rebuild-and-restart" class="btn btn-ghost btn-sm d-flex gap-2 align-items-center fw-semibold text-decoration-none justify-content-start" ><i class="fa fa-fw fa-refresh"></i> [[admin/menu:rebuild-and-restart]]</button>

<button component="restart" class="btn btn-ghost btn-sm d-flex gap-2 align-items-center fw-semibold text-decoration-none justify-content-start" ><i class="fa fa-fw fa-repeat"></i> [[admin/menu:restart]]</button>
{{{ end }}}

<button component="logout" class="btn btn-ghost btn-sm d-flex gap-2 align-items-center fw-semibold text-decoration-none justify-content-start" ><i class="fa fa-fw fa-sign-out"></i> [[admin/menu:logout]]</button>
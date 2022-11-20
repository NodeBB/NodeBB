<li component="logout">
	<a href="#" title="[[admin/menu:logout]]" data-bs-placement="bottom" data-bs-toggle="tooltip">
		<i class="fa fw-fw fa-sign-out"></i>
	</a>
</li>

{{{ if user.privileges.superadmin }}}
<li>
	<a href="#" class="restart" data-bs-toggle="tooltip" data-bs-placement="bottom" title="[[admin/menu:restart-forum]]">
		<i class="fa fa-fw fa-repeat"></i>
	</a>
</li>
<li>
	<a href="#" class="rebuild-and-restart" data-bs-toggle="tooltip" data-bs-placement="bottom" title="[[admin/menu:rebuild-and-restart-forum]]">
		<i class="fa fa-fw fa-refresh"></i>
	</a>
</li>
{{{ end }}}

<li>
	<a href="{config.relative_path}/" data-bs-toggle="tooltip" data-bs-placement="bottom" title="[[admin/menu:view-forum]]">
		<i class="fa fa-fw fa-home"></i>
	</a>
</li>
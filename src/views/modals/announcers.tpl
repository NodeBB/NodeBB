<div class="mb-3">
	{{{ each announcers }}}
	<a class="text-decoration-none" href="{config.relative_path}/user/{./userslug}">{buildAvatar(@value, "24px", true)}</a>
	{{{ end }}}
</div>

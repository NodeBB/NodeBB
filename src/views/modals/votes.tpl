{{{ if showUpvotes }}}
<div class="mb-3">
	<h4>[[global:upvoters]] <small>({upvoteCount})</small></h4>
	{{{ each upvoters }}}
	<a class="text-decoration-none" href="{config.relative_path}/user/{./userslug}">{buildAvatar(@value, "24px", true)}</a>
	{{{ end }}}
</div>
{{{ end }}}
{{{ if showDownvotes }}}
<div>
	<h4>[[global:downvoters]] <small>({downvoteCount})</small></h4>
	{{{ each downvoters }}}
	<a class="text-decoration-none" href="{config.relative_path}/user/{./userslug}">{buildAvatar(@value, "24px", true)}</a>
	{{{ end }}}
</div>
{{{ end }}}
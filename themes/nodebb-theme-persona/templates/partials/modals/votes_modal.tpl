<h3>[[global:upvoters]] <small>({upvoteCount})</small></h3>
{{{each upvoters}}}
<a href="{config.relative_path}/user/{upvoters.userslug}">{buildAvatar(upvoters, "sm", false)}</a>
{{{end}}}
<!-- IF showDownvotes -->
<h3>[[global:downvoters]] <small>({downvoteCount})</small></h3>
{{{each downvoters}}}
<a href="{config.relative_path}/user/{downvoters.userslug}">{buildAvatar(downvoters, "sm", false)}</a>
{{{end}}}
<!-- ENDIF showDownvotes -->

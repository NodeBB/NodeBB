<div id="post-tooltip" class="well" style="position:absolute; z-index: 1;">
    <div class="clearfix">
        <div class="icon pull-left">
            <a href="{{{ if post.user.userslug }}}{config.relative_path}/user/{post.user.userslug}{{{ else }}}#{{{ end }}}">
                {buildAvatar(post.user, "sm", true, "", "user/picture")} {post.user.username}
            </a>
        </div>
        <small class="pull-right">
            <span class="timeago" title="{post.timestampISO}"></span>
        </small>
    </div>
    <div class="content">{post.content}</div>
</div>

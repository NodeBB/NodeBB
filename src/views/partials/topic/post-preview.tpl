<div id="post-tooltip" class="card card-body shadow bg-body text-body z-1 position-absolute">
    <div class="d-flex flex-column gap-2">
        <div class="d-flex gap-1 align-items-center">
            <a href="{{{ if post.user.userslug }}}{config.relative_path}/user/{post.user.userslug}{{{ else }}}#{{{ end }}}">
                {buildAvatar(post.user, "24px", true, "", "user/picture")} {post.user.username}
            </a>
            <span class="timeago text-xs" title="{post.timestampISO}"></span>
        </div>
        <div class="content">{post.content}</div>
    </div>
</div>

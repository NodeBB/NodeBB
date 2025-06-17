<div id="post-tooltip" class="card card-body shadow bg-body text-body z-1 position-absolute">
    <div class="d-flex flex-column gap-2">
        <div class="d-flex gap-2 align-items-center">
            <div>
                <a href="{{{ if post.user.userslug }}}{config.relative_path}/user/{post.user.userslug}{{{ else }}}#{{{ end }}}">{buildAvatar(post.user, "20px", true, "", "user/picture")}</a>
                <a href="{{{ if post.user.userslug }}}{config.relative_path}/user/{post.user.userslug}{{{ else }}}#{{{ end }}}">{post.user.username}</a>
            </div>
            <div>
                <a href="{config.relative_path}/post/{post.pid}" class="timeago text-xs text-secondary lh-1" style="vertical-align: middle;" title="{post.timestampISO}"></a>
            </div>
        </div>
        <div class="content ghost-scrollbar" style="max-height: 300px; overflow-y:auto;">{post.content}</div>
    </div>
</div>

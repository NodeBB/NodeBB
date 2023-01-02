<li component="post" class="posts-list-item row<!-- IF ../deleted --> deleted<!-- ELSE --><!-- IF ../topic.deleted --> deleted<!-- ENDIF --><!-- ENDIF -->{{{ if ../topic.scheduled }}} scheduled{{{ end }}}" data-pid="{../pid}" data-uid="{../uid}">
    <div class="col-lg-11 col-sm-10 col-xs-9 post-body">
        <a class="topic-title" href="{config.relative_path}/post/{../pid}">
            <!-- IF !../isMainPost -->RE: <!-- ENDIF -->{../topic.title}
        </a>

        <div component="post/content" class="content">
            {../content}
        </div>

        <small class="topic-category"><a href="{config.relative_path}/category/{../category.slug}">[[global:posted_in, {../category.name}]]</a></small>

        {{{ if ../isMainPost }}}
        {{{ if ../topic.tags.length }}}
        <span class="tag-list">
            {{{ each ../topic.tags }}}
            <a href="{config.relative_path}/tags/{topic.tags.valueEncoded}"><span class="tag tag-item tag-class-{topic.tags.class}">{topic.tags.valueEscaped}</span></a>
            {{{ end }}}
        </span>
        {{{ end }}}
        {{{ end }}}

        <div class="post-info">
            <a href="{config.relative_path}/user/{../user.userslug}">{buildAvatar(../user, "md", true, "user-img not-responsive")}</a>

            <div class="post-author">
                <a href="{config.relative_path}/user/{../user.userslug}">{../user.displayname}</a><br />
                <span class="timeago" title="{../timestampISO}"></span>
            </div>
        </div>
    </div>
</li>
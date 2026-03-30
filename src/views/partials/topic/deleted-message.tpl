<div component="topic/deleted/message" class="alert alert-warning d-flex justify-content-between flex-wrap{{{ if !deleted }}} hidden{{{ end }}}">
    <span>[[topic:deleted-message]]</span>
    <span>
        {{{ if deleter }}}
        <a class="fw-bold" href="{config.relative_path}/user/{deleter.userslug}">{deleter.username}</a> <small class="timeago" title="{deletedTimestampISO}"></small>
        {{{ end }}}
    </span>
</div>
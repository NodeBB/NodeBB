<div component="topic/deleted/message" class="alert alert-warning mt-3{{{ if !deleted }}} hidden{{{ end }}} d-flex justify-content-between flex-wrap">
    <span>[[topic:deleted_message]]</span>
    <span>
        {{{ if deleter }}}
        <a class="fw-bold" href="{config.relative_path}/user/{deleter.userslug}">{deleter.username}</a> <small class="timeago" title="{deletedTimestampISO}"></small>
        {{{ end }}}
    </span>
</div>
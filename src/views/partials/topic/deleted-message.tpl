<div component="topic/deleted/message" class="alert alert-warning{{{ if !deleted }}} hidden{{{ end }}} clearfix">
    <span class="float-start">[[topic:deleted_message]]</span>
    <span class="float-end">
        {{{ if deleter }}}
        <a href="{config.relative_path}/user/{deleter.userslug}">
            <strong>{deleter.username}</strong>
        </a>
        <small class="timeago" title="{deletedTimestampISO}"></small>
        {{{ end }}}
    </span>
</div>
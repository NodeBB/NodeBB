<p><strong>{{tx("post-queue:category")}}</strong></p>
<p><a href="{notification.category.url}">{{tx(notification.category.name)}}</a></p>

<p><strong>{{{ if notification.topic.tid }}}{{tx("post-queue:topic")}}{{{ else }}}{{tx("post-queue:title")}}{{{ end }}}</strong></p>
<p>{{{ if notification.topic.url }}}<a href="{notification.topic.url}">{notification.topic.title}</a>{{{ else }}}{notification.topic.title}{{{ end }}}</p>

<p><strong>{{tx("post-queue:user")}}</strong></p>
<p>{{{ if notification.user.url }}}<a href="{notification.user.url}">{notification.user.username}</a>{{{ else }}}{notification.user.username}{{{ end }}}</p>
<p>{{txEscape(notification.content)}}</p>

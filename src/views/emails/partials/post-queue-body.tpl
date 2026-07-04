<p><strong>{{tx("post-queue:category")}}</strong></p>
<p><a href="{category.url}">{{tx(category.name)}}</a></p>

<p><strong>{{{ if topic.tid }}}{{tx("post-queue:topic")}}{{{ else }}}{{tx("post-queue:title")}}{{{ end }}}</strong></p>
<p>{{{ if topic.url }}}<a href="{topic.url}">{topic.title}</a>{{{ else }}}{topic.title}{{{ end }}}</p>

<p><strong>{{tx("post-queue:user")}}</strong></p>
<p>{{{ if user.url }}}<a href="{user.url}">{user.username}</a>{{{ else }}}{user.username}{{{ end }}}</p>
<p>{{txEscape(content)}}</p>

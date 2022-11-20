<p><strong>[[post-queue:category]]</strong></p>
<p><a href="{category.url}">{category.name}</a></p>

<p><strong>{{{ if topic.tid }}}[[post-queue:topic]]{{{ else }}}[[post-queue:title]]{{{ end }}}</strong></p>
<p>{{{ if topic.url }}}<a href="{topic.url}">{topic.title}</a>{{{ else }}}{topic.title}{{{ end }}}</p>

<p><strong>[[post-queue:user]]</strong></p>
<p>{{{ if user.url }}}<a href="{user.url}">{user.username}</a>{{{ else }}}{user.username}{{{ end }}}</p>
<p>{content}</p>

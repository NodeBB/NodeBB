{{{ if matchCount }}}
<div class="card card-header text-xs px-2 py-1 fw-semibold border-0 align-self-start">{{tx("search:results-matching", matchCount, txEscape(search_query), time)}}</div>
{{{ else }}}
{{{ if search_query }}}
<div class="badge text-bg-warning align-self-start">[[search:no-matches]]</div>
{{{ end }}}
{{{ end }}}

<div id="results" class="search-results" data-search-query="{search_query}">
	{{{ if showAsPosts }}}
	{{{ if posts.length }}}
	<!-- IMPORT partials/posts_list.tpl -->
	{{{ end }}}
	{{{ end }}}

	{{{ if showAsTopics }}}
	{{{ each posts }}}
	<hr/>
	<div class="topic-row  mb-3">
		<a class="topic-title fw-semibold fs-5 text-reset text-break" href="{config.relative_path}/post/{encodeURIComponent(./pid)}">
			{{{ if !./isMainPost }}}RE: {{{ end }}}{./topic.title}
		</a>
		<div class="post-body d-flex flex-column gap-1">
			<div class="d-flex gap-3 post-info">
				<div class="post-author d-flex gap-1">
					<a class="lh-1 text-decoration-none" href="{config.relative_path}/user/{./user.userslug}">{{buildAvatar(./user, "16px", true, "not-responsive")}}</a>
					<a class="fw-semibold text-sm" href="{config.relative_path}/user/{./user.userslug}">{./user.displayname}</a>
				</div>
				<span class="timeago text-sm text-muted" title="{./timestampISO}"></span>
			</div>
		</div>
	</div>
	{{{ end }}}
	{{{ end }}}

	{{{ if users.length }}}
	<!-- IMPORT partials/users_list.tpl -->
	{{{ end }}}

	{{{ if tags.length }}}
	<div class="tag-list row row-cols-2 row-cols-lg-3 row-cols-xl-4 gx-3 gy-2">
	<!-- IMPORT partials/tags_list.tpl -->
	</div>
	{{{ end }}}

	{{{ if categories.length }}}
	<ul class="categories list-unstyled">
		{{{each categories}}}
		<!-- IMPORT partials/categories/item.tpl -->
		{{{end}}}
	</ul>
	{{{ end }}}

	<!-- IMPORT partials/paginator.tpl -->
</div>
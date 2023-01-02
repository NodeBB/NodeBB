<!-- IMPORT partials/breadcrumbs.tpl -->
<div data-widget-area="header">
	{{{each widgets.header}}}
	{{widgets.header.html}}
	{{{end}}}
</div>
<div class="unread">
	<div class="topic-list-header btn-toolbar">
		<div class="pull-left">
			<!-- IMPORT partials/buttons/newTopic.tpl -->
			<a href="{config.relative_path}/{selectedFilter.url}{querystring}" class="inline-block">
				<div class="alert alert-warning hide" id="new-topics-alert"></div>
			</a>
		</div>

		<div class="btn-group pull-right">
		<!-- IMPORT partials/category/tools.tpl -->
		</div>

		<div class="markread btn-group pull-right {{{ if !topics.length }}}hidden{{{ end }}}">
		<!-- IMPORT partials/category-selector-right.tpl -->
		</div>

		<!-- IMPORT partials/category-filter-right.tpl -->

		<div class="btn-group pull-right bottom-sheet">
			<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">
				<span class="visible-sm-inline visible-md-inline visible-lg-inline">{selectedFilter.name}</span><span class="visible-xs-inline"><i class="fa fa-fw {selectedFilter.icon}"></i></span> <span class="caret"></span>
			</button>
			<ul class="dropdown-menu" role="menu">
				{{{each filters}}}
				<li role="presentation" class="category {{{if filters.selected}}}selected{{{end}}}">
					<a role="menu-item" href="{config.relative_path}/{filters.url}"><i class="fa fa-fw <!-- IF filters.selected -->fa-check<!-- ENDIF filters.selected -->"></i>{filters.name}</a>
				</li>
				{{{end}}}
			</ul>
		</div>
	</div>

	<div class="category">
		<div id="category-no-topics" class="alert alert-warning <!-- IF topics.length -->hidden<!-- ENDIF topics.length -->">[[unread:no_unread_topics]]</div>

		<!-- IMPORT partials/topics_list.tpl -->
		<button id="load-more-btn" class="btn btn-primary hide">[[unread:load_more]]</button>
		<!-- IF config.usePagination -->
			<!-- IMPORT partials/paginator.tpl -->
		<!-- ENDIF config.usePagination -->
	</div>
</div>

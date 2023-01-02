<!-- IMPORT partials/breadcrumbs.tpl -->
<div data-widget-area="header">
	{{{each widgets.header}}}
	{{widgets.header.html}}
	{{{end}}}
</div>
<div class="popular">
	<div class="topic-list-header btn-toolbar">
		<div class="pull-left">
			<!-- IF canPost -->
			<!-- IMPORT partials/buttons/newTopic.tpl -->
			<!-- ELSE -->
			<a component="category/post/guest" href="{config.relative_path}/login" class="btn btn-primary">[[category:guest-login-post]]</a>
			<!-- ENDIF canPost -->
		</div>

		<div class="btn-group pull-right">
		<!-- IMPORT partials/category/tools.tpl -->
		</div>

		<!-- IMPORT partials/category-filter-right.tpl -->

		<div class="btn-group pull-right bottom-sheet <!-- IF !filters.length -->hidden<!-- ENDIF !filters.length -->">
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

		<div class="btn-group pull-right bottom-sheet <!-- IF !terms.length -->hidden<!-- ENDIF !terms.length -->">
			<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">
			{selectedTerm.name} <span class="caret"></span>
			</button>
			<ul class="dropdown-menu" role="menu">
				{{{each terms}}}
				<li role="presentation" class="category">
					<a role="menu-item" href="{config.relative_path}/{terms.url}"><i class="fa fa-fw <!-- IF terms.selected -->fa-check<!-- ENDIF terms.selected -->"></i>{terms.name}</a>
				</li>
				{{{end}}}
			</ul>
		</div>
	</div>

	<div class="category">
		<!-- IF !topics.length -->
		<div class="alert alert-warning" id="category-no-topics">[[recent:no_popular_topics]]</div>
		<!-- ENDIF !topics.length -->

		<!-- IMPORT partials/topics_list.tpl -->

		<!-- IF config.usePagination -->
			<!-- IMPORT partials/paginator.tpl -->
		<!-- ENDIF config.usePagination -->
	</div>
</div>

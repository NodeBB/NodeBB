<div class="account">
	<!-- IMPORT partials/account/header.tpl -->

	<div class="row">
		<h1>{title}</h1>
		<!-- IF showSort -->
		<div class="row clearfix">
			<div class="pull-right btn-group bottom-sheet" component="thread/sort">
				<button class="btn btn-default dropdown-toggle" data-toggle="dropdown" type="button"><span>[[topic:sort_by]]</span> <span class="caret"></span></button>
				<ul class="dropdown-menu dropdown-menu-right">
					{{{each sortOptions }}}
					<li><a href="{config.relative_path}{sortOptions.url}"><i class="fa fa-fw {{{if sortOptions.selected}}}fa-check{{{end}}}"></i>{sortOptions.name}</a></li>
					{{{end}}}
				</ul>
			</div>
		</div>
		<!-- ENDIF showSort -->

		<!-- IF !topics.length -->
			<div class="alert alert-warning text-center">{noItemsFoundKey}</div>
		<!-- ENDIF !topics.length -->

		<div class="category">
			<!-- IMPORT partials/topics_list.tpl -->
			<!-- IF config.usePagination -->
				<!-- IMPORT partials/paginator.tpl -->
			<!-- ENDIF config.usePagination -->
		</div>
	</div>
</div>

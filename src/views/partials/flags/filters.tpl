<div component="flags/filters" class="d-flex flex-wrap gap-2 pb-3 border-bottom">
	<div class="dropdown bottom-sheet">
		<a class="filter-btn btn btn-light btn-sm border {{{ if filters.quick }}}active-filter{{{ end }}} dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-haspopup="true" aria-expanded="false">
			<span class="filter-label">
				{{{ if filters.quick }}}
				{{tx(concat("flags:filter-quick-", ./filters.quick))}}
				{{{ else }}}
				{{tx("flags:quick-filters")}}
				{{{ end }}}
			</span>
			<span class="caret text-primary opacity-75"></span>
		</a>
		<ul class="dropdown-menu p-1 text-sm" role="menu">
			<li>
				<a class="dropdown-item rounded-1" href="{config.relative_path}/flags?quick=mine" role="menuitem">{{tx("flags:filter-quick-mine")}}</a>
			</li>
		</ul>
	</div>

	<div component="category/dropdown" class="dropdown category-dropdown-container bottom-sheet">
		<button type="button" class="filter-btn btn btn-light btn-sm border dropdown-toggle {{{ if filters.cid }}}active-filter{{{ end }}}" data-bs-toggle="dropdown">
			{{{ if selectedCategory }}}
			<span class="category-item d-inline-flex align-items-baseline gap-1">
				{{buildCategoryIcon(selectedCategory, "18px", "rounded-circle align-self-center")}}
				<span class="visible-md-inline visible-lg-inline">{{stripTags(tx(selectedCategory.name))}}</span>
			</span>
			{{{ else }}}
			<span class="visible-md-inline visible-lg-inline">{{tx("unread:all-categories")}}</span>
			{{{ end }}}
			<span class="caret text-primary opacity-75"></span>
		</button>

		<div class="dropdown-menu p-1">
			<div component="category-selector-search" class="p-1 hidden">
				<input type="text" class="form-control form-control-sm" placeholder="{{tx("search:type-to-search")}}" autocomplete="off">
				<hr class="mt-2 mb-0"/>
			</div>
			<ul component="category/list" class="list-unstyled mb-0 text-sm category-dropdown-menu ghost-scrollbar" role="menu">
				<!-- filled by categorySearch module-->
			</ul>
		</div>
	</div>

	<div class="dropdown bottom-sheet">
		<a class="filter-btn btn btn-light btn-sm border {{{ if (sort != "newest") }}}active-filter{{{ end }}} dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-haspopup="true" aria-expanded="false">
			<span class="filter-label">{{{ if (sort != "newest") }}}{{tx(concat("flags:sort-", ./sort))}}{{{ else }}}{{tx("flags:sort")}}{{{ end }}}</span>
			<span class="caret text-primary opacity-75"></span>
		</a>
		<ul class="dropdown-menu p-1 text-sm" role="menu">
			<li><h6 class="dropdown-header">{{tx("flags:sort-all")}}</h6></li>
			<li class="dropdown-item rounded-1" data-name="sort" data-value="newest" role="menuitem">{{tx("flags:sort-newest")}}</li>
			<li class="dropdown-item rounded-1" data-name="sort" data-value="oldest" role="menuitem">{{tx("flags:sort-oldest")}}</li>
			<li class="dropdown-item rounded-1" data-name="sort" data-value="reports" role="menuitem">{{tx("flags:sort-reports")}}</li>
			<li><h6 class="dropdown-header">{{tx("flags:sort-posts-only")}}</h6></li>
			<li class="dropdown-item rounded-1" data-name="sort" data-value="downvotes" role="menuitem">{{tx("flags:sort-downvotes")}}</li>
			<li class="dropdown-item rounded-1" data-name="sort" data-value="upvotes" role="menuitem">{{tx("flags:sort-upvotes")}}</li>
			<li class="dropdown-item rounded-1" data-name="sort" data-value="replies" role="menuitem">{{tx("flags:sort-replies")}}</li>
		</ul>
	</div>

	<div class="dropdown bottom-sheet">
		<a class="filter-btn btn btn-light btn-sm border {{{ if filters.state }}}active-filter{{{ end }}} dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-haspopup="true" aria-expanded="false">
			<span class="filter-label">{{{ if filters.state }}}{{tx(concat("flags:state-", ./filters.state))}}{{{ else }}}{{tx("flags:filter-state")}}{{{ end }}}</span>
			<span class="caret text-primary opacity-75"></span>
		</a>
		<ul class="dropdown-menu p-1 text-sm" role="menu">
			<li class="dropdown-item rounded-1" data-name="state" data-value="open" role="menuitem">{{tx("flags:state-open")}}</li>
			<li class="dropdown-item rounded-1" data-name="state" data-value="wip" role="menuitem">{{tx("flags:state-wip")}}</li>
			<li class="dropdown-item rounded-1" data-name="state" data-value="resolved" role="menuitem">{{tx("flags:state-resolved")}}</li>
			<li class="dropdown-item rounded-1" data-name="state" data-value="rejected" role="menuitem">{{tx("flags:state-rejected")}}</li>
		</ul>
	</div>

	<div class="dropdown bottom-sheet">
		<a class="filter-btn btn btn-light btn-sm border {{{ if filters.type }}}active-filter{{{ end }}} dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-haspopup="true" aria-expanded="false">
			<span class="filter-label">{{{ if filters.type }}}{{tx(concat("flags:filter-type-", ./filters.type))}}{{{ else }}}{{tx("flags:filter-type")}}{{{ end }}}</span>
			<span class="caret text-primary opacity-75"></span>
		</a>
		<ul class="dropdown-menu p-1 text-sm" role="menu">
			<li class="dropdown-item rounded-1" data-name="type" data-value="all" role="menuitem">{{tx("flags:filter-type-all")}}</li>
			<li class="dropdown-item rounded-1" data-name="type" data-value="post" role="menuitem">{{tx("flags:filter-type-post")}}</li>
			<li class="dropdown-item rounded-1" data-name="type" data-value="user" role="menuitem">{{tx("flags:filter-type-user")}}</li>
		</ul>
	</div>

	<div component="flags/filter/assignee" class="dropdown bottom-sheet" data-filter-name="assignee">
		<a component="user/filter/button" class="filter-btn btn btn-light btn-sm border {{{ if filters.assignee }}}active-filter{{{ end }}} dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-haspopup="true" aria-expanded="false">
			<span class="filter-label">{{tx("flags:filter-assignee")}}</span>
			<span class="caret text-primary opacity-75"></span>
		</a>

		<ul class="dropdown-menu p-1 text-sm" style="min-width: 350px;" role="menu">
			<li class="px-3 py-1 d-flex flex-column gap-2">
				<input type="text" class="form-control" component="user/filter/search" placeholder="{{tx("search:type-a-username")}}">
				<div component="user/filter/selected" class="d-flex flex-wrap gap-2">
					{{{ each selected.assignee }}}
					<div class="d-flex px-2 py-1 rounded-1 text-bg-primary gap-2 align-items-center text-sm">
						{{buildAvatar(@value, "16px", true)}} {./username}
						<button component="user/filter/delete" data-uid="{./uid}" class="btn btn-primary btn-sm py-0"><i class="fa fa-times fa-xs"></i></button>
					</div>
					{{{ end }}}
				</div>
				<hr/>
				<div component="user/filter/results" class="d-flex flex-wrap gap-2">
					{{{ each userFilterResults }}}
					<button class="btn btn-light btn-sm border" data-uid="{./uid}" data-username="{./username}">{{buildAvatar(@value, "16px", true)}} {./username}</button>
					{{{ end }}}
				</div>
			</li>
		</ul>
	</div>

	<div component="flags/filter/reporterId" class="dropdown bottom-sheet" data-filter-name="reporterId">
		<a component="user/filter/button" class="filter-btn btn btn-light btn-sm border {{{ if filters.reporterId }}}active-filter{{{ end }}} dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-haspopup="true" aria-expanded="false">
			<span class="filter-label">{{tx("flags:filter-reporterId")}}</span>
			<span class="caret text-primary opacity-75"></span>
		</a>

		<ul class="dropdown-menu p-1 text-sm" style="min-width: 350px;" role="menu">
			<li class="px-3 py-1 d-flex flex-column gap-2">
				<input type="text" class="form-control" component="user/filter/search" placeholder="{{tx("search:type-a-username")}}">
				<div component="user/filter/selected" class="d-flex flex-wrap gap-2">
					{{{ each selected.reporterId }}}
					<div class="d-flex px-2 py-1 rounded-1 text-bg-primary gap-2 align-items-center text-sm">
						{{buildAvatar(@value, "16px", true)}} {./username}
						<button component="user/filter/delete" data-uid="{./uid}" class="btn btn-primary btn-sm py-0"><i class="fa fa-times fa-xs"></i></button>
					</div>
					{{{ end }}}
				</div>
				<hr/>
				<div component="user/filter/results" class="d-flex flex-wrap gap-2">
					{{{ each userFilterResults }}}
					<button class="btn btn-light btn-sm border" data-uid="{./uid}" data-username="{./username}">{{buildAvatar(@value, "16px", true)}} {./username}</button>
					{{{ end }}}
				</div>
			</li>
		</ul>
	</div>

	<div component="flags/filter/targetUid" class="dropdown bottom-sheet" data-filter-name="targetUid">
		<a component="user/filter/button" class="filter-btn btn btn-light btn-sm border {{{ if filters.targetUid }}}active-filter{{{ end }}} dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-haspopup="true" aria-expanded="false">
			<span class="filter-label">{{tx("flags:filter-targetUid")}}</span>
			<span class="caret text-primary opacity-75"></span>
		</a>

		<ul class="dropdown-menu p-1 text-sm" style="min-width: 350px;" role="menu">
			<li class="px-3 py-1 d-flex flex-column">
				<input type="text" class="form-control" component="user/filter/search" placeholder="{{tx("search:type-a-username")}}">
				<div component="user/filter/selected" class="d-flex flex-wrap gap-2">
					{{{ each selected.targetUid }}}
					<div class="d-flex px-2 py-1 rounded-1 text-bg-primary gap-2 align-items-center text-sm">
						{{buildAvatar(@value, "16px", true)}} {./username}
						<button component="user/filter/delete" data-uid="{./uid}" class="btn btn-primary btn-sm py-0"><i class="fa fa-times fa-xs"></i></button>
					</div>
					{{{ end }}}
				</div>
				<hr/>
				<div component="user/filter/results" class="d-flex flex-wrap gap-2">
					{{{ each userFilterResults }}}
					<button class="btn btn-light btn-sm border" data-uid="{./uid}" data-username="{./username}">{{buildAvatar(@value, "16px", true)}} {./username}</button>
					{{{ end }}}
				</div>
			</li>
		</ul>
	</div>

	<div component="flags/filters/reset" class="ms-auto">
		<a class="filter-btn btn btn-warning btn-sm border {{{ if !hasFilter }}}btn-light disabled{{{ end }}}" href="{config.relative_path}/flags" role="button">
			<span class="filter-label">{{tx("flags:filter-reset")}}</span>
		</a>
	</div>

	<!-- IMPORT partials/flags/bulk-actions.tpl -->

	<form role="form">
		<input type="hidden" name="sort" value="{./sort}" />
		<input type="hidden" name="state" value="{./filters.state}" />
		<input type="hidden" name="type" value="{./filters.type}" />
	</form>
</div>
<div class="dropdown bottom-sheet{{{ if !filters.length }}} hidden{{{ end }}}">
	<button type="button" class="btn btn-ghost btn-sm ff-secondary d-flex gap-2 align-items-center dropdown-toggle h-100" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
		<i class="fa fa-fw fa-filter text-primary"></i>
		<span class="visible-md-inline visible-lg-inline fw-semibold">{selectedFilter.name}</span>
	</button>
	<ul class="dropdown-menu p-1 text-sm" role="menu">
		{{{each filters}}}
		<li role="presentation" class="category {{{if filters.selected}}}selected{{{end}}}">
			<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem" href="{config.relative_path}/{filters.url}">
				<div class="flex-grow-1">{filters.name}</div>
				<i class="flex-shrink-0 fa fa-fw {{{ if filters.selected }}}fa-check{{{ end }}}"></i>
			</a>
		</li>
		{{{end}}}
	</ul>
</div>
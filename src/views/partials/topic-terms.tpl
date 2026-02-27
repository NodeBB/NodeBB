<div class="dropdown bottom-sheet {{{ if !terms.length }}}hidden{{{ end }}}">
	<button type="button" class="btn btn-ghost btn-sm ff-secondary d-flex align-items-center gap-2 dropdown-toggle h-100" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
		<i class="fa fa-fw fa-clock text-primary"></i>
		<span class="visible-md-inline visible-lg-inline fw-semibold">{selectedTerm.name}</span>
	</button>
	<ul class="dropdown-menu p-1 text-sm" role="menu">
		{{{each terms}}}
		<li role="presentation" class="category">
			<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" role="menuitem" href="{config.relative_path}/{terms.url}">
				<div class="flex-grow-1">{terms.name}</div>
				<i class="flex-shrink-0 fa fa-fw {{{ if terms.selected }}}fa-check{{{ end }}}"></i>
			</a>
		</li>
		{{{end}}}
	</ul>
</div>
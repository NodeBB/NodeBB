<form type="form">
	<div class="form-group">
		<div component="category-selector" class="btn-group">
			<button type="button" class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">
				<span component="category-selector-selected">[[topic:thread_tools.select_category]]</span> <span class="caret"></span>
			</button>
			<div component="category-selector-search" class="hidden position-absolute">
				<input type="text" class="form-control" autocomplete="off">
			</div>
			<ul component="category/list" class="dropdown-menu category-dropdown-menu" role="menu">
				<li component="category/no-matches" role="presentation" class="category hidden">
					<a class="dropdown-item" role="menuitem">[[search:no-matches]]</a>
				</li>
				<!-- BEGIN categories -->
				<li role="presentation" class="category {{{if categories.disabledClass}}}disabled{{{end}}}" data-cid="{categories.cid}" data-name="{categories.name}">
					<a class="dropdown-item" role="menuitem">{categories.level}
						<span component="category-markup">
							<div class="category-item d-inline-block">
								<div role="presentation" class="icon pull-left" style="{function.generateCategoryBackground}">
									<i class="fa fa-fw {./icon}"></i>
								</div>
								{./name}
							</div>
						</span>
					</a>
				</li>
				<!-- END categories -->
			</ul>
		</div>
	</div>
</form>
{{{ if message }}}
<div>{message}</div>
{{{ end }}}
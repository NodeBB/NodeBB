<form type="form">
	<div class="form-group">
		<div component="category-selector" class="btn-group">
			<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">
				<span component="category-selector-selected">[[topic:thread_tools.select_category]]</span> <span class="caret"></span>
			</button>
			<div component="category-selector-search" class="hidden">
				<input type="text" class="form-control" autocomplete="off">
			</div>
			<ul component="category/list" class="dropdown-menu category-dropdown-menu" role="menu">
				<li component="category/no-matches" role="presentation" class="category hidden">
					<a role="menu-item">[[search:no-matches]]</a>
				</li>
				<!-- BEGIN categories -->
				<li role="presentation" class="category" data-cid="{categories.cid}" data-name="{categories.name}">
					<a role="menu-item">{categories.level}<span component="category-markup"><!-- IF categories.icon --><span class="fa-stack" style="{function.generateCategoryBackground}"><i style="color: {categories.color};" class="fa fa-stack-1x fa-fw {categories.icon}"></i></span><!-- ENDIF categories.icon --> {categories.name}</span></a>
				</li>
				<!-- END categories -->
			</ul>
		</div>
	</div>
</form>
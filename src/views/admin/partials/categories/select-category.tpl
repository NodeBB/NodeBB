<form type="form">
	<div class="form-group">
		<div component="category-selector" class="btn-group">
			<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">
				<span component="category-selector-selected">[[topic:thread_tools.select_category]]</span> <span class="caret"></span>
			</button>
			<ul class="dropdown-menu category-dropdown-menu" role="menu">
				<!-- BEGIN categories -->
				<li role="presentation" class="category" data-cid="{categories.cid}" data-name="{categories.name}">
					<a role="menu-item">{categories.level}<span component="category-markup"><!-- IF categories.icon --><span class="fa-stack"><i style="color: {categories.bgColor};" class="fa fa-circle fa-stack-2x"></i><i style="color: {categories.color};" class="fa fa-stack-1x fa-fw {categories.icon}"></i></span><!-- ENDIF categories.icon --> {categories.name}</span></a>
				</li>
				<!-- END categories -->
			</ul>
		</div>
	</div>
</form>
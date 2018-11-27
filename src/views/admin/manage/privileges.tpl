<div class="row">
	<form role="form" class="category">
		<div class="">
			<p>
				[[admin/manage/categories:privileges.description]]
			</p>

			<p class="lead">
				[[admin/manage/categories:privileges.category-selector]]
				<button type="button" id="category-selector" class="mdl-button mdl-js-button mdl-button--raised mdl-button--colored">
					{selected} <i class="fa fa-angle-down"></i>
				</button>

				<ul class="mdl-menu mdl-menu--bottom-left mdl-js-menu mdl-js-ripple-effect" for="category-selector">
					<li class="mdl-menu__item mdl-menu__item--full-bleed-divider" data-cid="global">[[admin/manage/privileges:global]]</li>
					<!-- BEGIN allCategories -->
					<li class="mdl-menu__item" data-cid="{../value}">{../text}</li>
					<!-- END -->
				</ul>
			</p>

			<hr />

			<div class="privilege-table-container">
				<!-- IF cid -->
				<!-- IMPORT admin/partials/categories/privileges.tpl -->
				<!-- ELSE -->
				<!-- IMPORT admin/partials/global/privileges.tpl -->
				<!-- ENDIF cid -->
			</div>
		</div>
	</form>
</div>

<div class="row">
	<form role="form" class="category">
		<div class="">
			<p>
				[[admin/manage/categories:privileges.description]]
			</p>

			<div class="lead">
				[[admin/manage/categories:privileges.category-selector]]
				<!-- IMPORT partials/category-selector.tpl -->
			</div>

			<div class="privilege-table-container">
				{{{ if cid }}}
				<!-- IMPORT admin/partials/privileges/category.tpl -->
				{{{ else }}}
				<!-- IMPORT admin/partials/privileges/global.tpl -->
				{{{ end }}}
			</div>
		</div>
	</form>
</div>

<div class="floating-button">
	<button id="discard" class="mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored" style="display: none;">
		<i class="material-icons">undo</i>
	</button>

	<button id="save" class="mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored primary">
		<i class="material-icons">save</i>
	</button>
</div>
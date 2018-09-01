<div class="row">
	<form role="form" class="category">
		<div class="row">
			<div class="col-md-3 pull-right">
				<select id="category-selector" class="form-control">
					<option value="global" <!-- IF !cid --> selected <!-- ENDIF !cid -->>[[admin/manage/privileges:global]]</option>
					<option disabled>_____________</option>
					<!-- BEGIN allCategories -->
					<option value="{allCategories.value}" <!-- IF allCategories.selected -->selected<!-- ENDIF allCategories.selected -->>{allCategories.text}</option>
					<!-- END allCategories -->
				</select>
			</div>
		</div>

		<br/>

		<div class="">
			<p>
				[[admin/manage/categories:privileges.description]]
			</p>
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

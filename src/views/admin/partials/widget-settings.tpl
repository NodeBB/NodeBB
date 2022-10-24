<div class="mb-3">
	<label class="form-label">[[admin/extend/widgets:title]]</label>
	<input type="text" class="form-control" name="title" placeholder="[[admin/extend/widgets:title.placeholder]]" />
</div>

<div class="mb-3">
	<label class="form-label">[[admin/extend/widgets:container]]</label>
	<textarea rows="4" class="form-control container-html" name="container" placeholder="[[admin/extend/widgets:container.placeholder]]"></textarea>
</div>

<!-- IMPORT admin/partials/widgets/show_hide_groups.tpl -->

<div class="form-check form-switch">
	<input class="form-check-input" type="checkbox" name="hide-mobile" id="hide-mobile-check"/>
	<label class="form-check-label" for="hide-mobile-check">[[admin/extend/widgets:hide-on-mobile]]</label>
</div>

<!-- IMPORT partials/breadcrumbs.tpl -->
<div class="row">
    <div class="col-lg-12">
        <div class="category btn-group">
            <!-- IMPORT partials/category-selector.tpl -->
        </div>
        <div class="btn-group">
            <button id="collapse-all" class="btn btn-default">[[admin/manage/categories:collapse-all]]</button>
        </div>
        <div class="btn-group">
            <button id="expand-all" class="btn btn-default">[[admin/manage/categories:expand-all]]</button>
        </div>
    </div>
</div>


<hr/>
<div component="category/no-matches" class="hidden">[[admin/manage/categories:no-matches]]</div>
<div class="categories"></div>
<div>
    <!-- IMPORT partials/paginator.tpl -->
</div>
<button data-action="create" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
    <i class="material-icons">add</i>
</button>
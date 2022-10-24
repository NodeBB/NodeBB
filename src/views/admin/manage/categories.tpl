<!-- IMPORT partials/breadcrumbs.tpl -->
<div class="row">
    <div class="col-lg-12">
        <div class="category btn-group">
            <!-- IMPORT partials/category-selector.tpl -->
        </div>
        <div class="btn-group">
            <button id="collapse-all" class="btn btn-outline-secondary">[[admin/manage/categories:collapse-all]]</button>
        </div>
        <div class="btn-group">
            <button id="expand-all" class="btn btn-outline-secondary">[[admin/manage/categories:expand-all]]</button>
        </div>
    </div>
</div>


<hr/>
<div component="category/no-matches" class="hidden">[[admin/manage/categories:no-matches]]</div>
<div class="categories"></div>
<div>
    <!-- IMPORT partials/paginator.tpl -->
</div>
<button data-action="create" class="btn btn-primary position-fixed bottom-0 end-0 px-3 py-2 mb-4 me-4 rounded-circle fs-4" type="button" style="width: 64px; height: 64px;">
    <i class="fa fa-fw fa-plus"></i>
</button>
<div class="row">
    <div class="col-lg-9">
        <button id="collapse-all" class="btn btn-default">[[admin/manage/categories:collapse-all]]</button> <button id="expand-all" class="btn btn-default">[[admin/manage/categories:expand-all]]</button>
    </div>
    <div class="col-lg-3">
        <div class="input-group">
            <input type="text" class="form-control" placeholder="[[global:search]]" id="category-search">
            <span class="input-group-addon search-button"><i class="fa fa-search"></i></span>
        </div>
    </div>
</div>


<hr/>
<div component="category/no-matches" class="hidden">[[admin/manage/categories:no-matches]]</div>
<div class="categories"></div>

<button data-action="create" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
    <i class="material-icons">add</i>
</button>

<input class="form-control" type="text" placeholder="{{tx("global:search")}}"/>

<div class="list-group" id="search-result">
    {{{each users}}}
    <a href="#" class="list-group-item list-group-item-action" data-username="{users.username}" data-uid="{users.uid}">{users.username} <i class="fa fa-fw fa-check invisible"></i></a>
    {{{end}}}
</div>

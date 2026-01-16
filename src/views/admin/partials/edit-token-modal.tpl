<form role="form">
    <div class="mb-3">
        <label class="form-label" for="uid">[[admin/settings/api:uid]]</label>
        <input id="uid" type="number" inputmode="numeric" pattern="\d+" name="uid" class="form-control" placeholder="0" value="{./uid}" />
        <p class="form-text">
            [[admin/settings/api:uid-help-text]]
        </p>
    </div>
    <div class="mb-3">
        <label class="form-label" for="description">[[admin/settings/api:description]]</label>
        <input id="description" type="text" name="description" class="form-control" placeholder="Description" value="{./description}" />
    </div>
</form>
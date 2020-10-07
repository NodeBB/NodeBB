<form>
    <input type="hidden" name="token" />
    <input type="hidden" name="timestamp" />
    <div class="form-group">
        <label for="uid">[[admin/settings/api:uid]]</label>
        <input type="number" name="uid" class="form-control" placeholder="1" min="0" />
        <p class="help-text">
            [[admin/settings/api:uid-help-text]]
        </p>
    </div>
    <div class="form-group">
        <label for="description">[[admin/settings/api:description]]</label>
        <input type="text" name="description" class="form-control" placeholder="Description" />
    </div>
</form>
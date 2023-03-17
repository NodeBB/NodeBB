<li data-type="item" class="list-group-item">
    <div class="row">
        <div class="col-9">
            <span class="badge bg-primary">{{{ if uid }}}uid {uid}{{{ else }}}master{{{ end }}}</span>
            {{{ if token }}}<input class="form-control-plaintext" type="text" readonly="readonly" value="{token}" size="32" />{{{ else }}}<em class="text-warning">[[admin/settings/api:token-on-save]]</em>{{{ end }}}<br />
            <p>
                {{{ if description }}}
                {description}
                {{{ else }}}
                <em>[[admin/settings/api:no-description]]</em>
                {{{ end }}}
                <br />
                <small>{timestampISO}</small>
            </p>
        </div>
        <div class="col-3 text-end">
            <button type="button" data-type="edit" class="btn btn-info">Edit</button>
            <button type="button" data-type="remove" class="btn btn-danger">Delete</button>
        </div>
    </div>
</li>
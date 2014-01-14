# Locale override examples for timeago

You can represent time statements in most western languages where
a prefix and/or suffix is used.

The default case is to use suffix only (as in English), which you
do by providing the `suffixAgo` and `suffixFromNow` settings in
the strings hash (earlier versions of timeago used the deprecated
`ago` and `fromNow` options). If present, they are used.

    2 minutes [suffixAgo]
    2 minutes [suffixFromNow]

In case you want to use prefix only instead of
suffix (e.g. Greek), you provide the `prefixAgo` and
`prefixFromNow` options in the strings hash and leave `suffixAgo`
and `suffixFromNow` empty or null.

    [prefixAgo] 2 minutes
    [prefixFromNow] 2 minutes

For languages where you want to use a prefix only for future
tense and prefix/suffix for past tense (for example swedish), you
can combine the prefix and suffixes as needed.

    [prefixAgo] 2 minutes [suffixAgo]
    [prefixFromNow] 2 minutes

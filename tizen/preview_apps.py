#!/usr/bin/env python3
"""Reads a Samsung TV's apps over SDB into samsung-apps.local.json, which the browser preview
(python3 tizen/build.py --preview) then shows in place of its sample apps. Only the preview uses it.

    python3 tizen/preview_apps.py <TV IP>
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import install  # noqa: E402

OUT = os.path.join(install.ROOT, 'samsung-apps.local.json')


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    try:
        sdb = install.Sdb(sys.argv[1])
    except (OSError, ConnectionError) as e:
        sys.exit('Couldn\'t reach the TV on port %d (%s). If Samsung\'s sdb is running, stop it: sdb kill-server'
                 % (install.PORT, e))
    text = sdb.shell('0 vd_applist', None, 40)   # until the TV closes the stream
    apps = []
    # Each app is a block of "-----key = value-----" lines; the title comes before the Tizen id.
    for block in re.split(r'app_index\s*=', text)[1:]:
        title = re.search(r'app_title\s*=(.*?)-{5,}', block)
        app_id = re.search(r'app_tizen_id\s*=(.*?)-{5,}', block)
        if title and app_id and app_id.group(1).strip() != 'FreeMyTVio.FreeMyTV':
            apps.append([app_id.group(1).strip(), title.group(1).strip()])
    if not apps:
        sys.exit('The TV listed no apps. It said:\n' + text.strip()[:500])
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(apps, f, indent=1, ensure_ascii=False)
    print('Wrote %d apps to samsung-apps.local.json. Now: python3 tizen/build.py --preview' % len(apps))


if __name__ == '__main__':
    main()

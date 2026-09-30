import importlib.util
from pathlib import Path
import json
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts/pages-has-www.py'
spec = importlib.util.spec_from_file_location('pages_has_www', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

BEFORE = [
    {'Project Name': 'salty-lamps-staging', 'Project Domains': 'salty-lamps-staging.pages.dev, admin.saltylamps.co.uk, test.saltylamps.co.uk'},
    {'Project Name': 'salty-lamps', 'Project Domains': 'salty-lamps.pages.dev, www.saltylamps.co.uk'},
]


def run(projects, name):
    # Wrangler prints a banner before the JSON; the helper must cope with it.
    text = 'wrangler banner [update available]\n' + json.dumps(projects)
    return subprocess.run([sys.executable, str(SCRIPT), name], input=text, capture_output=True, text=True).returncode


class PagesHasWwwTests(unittest.TestCase):
    def test_holding_project_serves_www_but_the_shop_does_not_yet(self):
        self.assertTrue(module.serves_www(BEFORE, 'salty-lamps'))
        self.assertFalse(module.serves_www(BEFORE, 'salty-lamps-staging'))

    def test_after_the_move_the_shop_serves_www_and_the_script_says_so(self):
        after = [dict(BEFORE[0], **{'Project Domains': BEFORE[0]['Project Domains'] + ', www.saltylamps.co.uk'}), BEFORE[1]]
        self.assertEqual(run(after, 'salty-lamps-staging'), 0)
        self.assertEqual(run(BEFORE, 'salty-lamps-staging'), 1)

    def test_an_unreadable_or_incomplete_list_is_never_read_as_not_live(self):
        self.assertEqual(run(BEFORE, 'no-such-project'), 2)
        bad = subprocess.run([sys.executable, str(SCRIPT), 'salty-lamps-staging'], input='not json', capture_output=True, text=True)
        self.assertEqual(bad.returncode, 2)

    def test_a_lookalike_hostname_does_not_count(self):
        lookalike = [{'Project Name': 'p', 'Project Domains': 'notwww.saltylamps.co.uk, www.saltylamps.co.uk.evil.test'}]
        self.assertFalse(module.serves_www(lookalike, 'p'))


if __name__ == '__main__':
    unittest.main()

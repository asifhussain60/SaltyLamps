import copy
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release', ROOT / 'scripts/publish-release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseApprovalTests(unittest.TestCase):
    def setUp(self):
        self.receipt = {'environment': 'development', 'project': release.PROJECT,
                        'branch': 'develop', 'commit': 'a' * 40,
                        'fingerprint': 'b' * 64, 'deployment_id': 'reviewed-deployment', 'dirty': False}
        self.approval = {**self.receipt, 'approved_by': 'Asif', 'note': 'Owner reviewed; publish approved',
                         'owner_accepted': True}

    def test_exact_committed_signed_off_version_passes(self):
        release.validate_release(self.receipt, 'a' * 40, 'b' * 64, False)
        release.validate_sign_off(self.approval, self.receipt)

    def test_dirty_changed_or_wrong_branch_source_is_refused(self):
        for mutate in (
            lambda r: r.update(branch='main'), lambda r: r.update(project='salty-lamps-staging'),
            lambda r: r.update(environment='production'), lambda r: r.update(commit='c' * 40),
            lambda r: r.update(fingerprint='d' * 64), lambda r: r.update(dirty=True),
            lambda r: r.pop('deployment_id'),
        ):
            receipt = copy.deepcopy(self.receipt); mutate(receipt)
            with self.assertRaises(ValueError):
                release.validate_release(receipt, 'a' * 40, 'b' * 64, False)
        with self.assertRaises(ValueError):
            release.validate_release(self.receipt, 'a' * 40, 'b' * 64, True)

    def test_another_deployment_or_incomplete_business_approval_is_refused(self):
        for key, value in [('deployment_id', 'later-deployment'), ('commit', 'c' * 40),
                           ('fingerprint', 'changed'), ('approved_by', ''), ('note', ''),
                           ('owner_accepted', False)]:
            approval = {**self.approval, key: value}
            with self.assertRaises(ValueError):
                release.validate_sign_off(approval, self.receipt)

    def test_hosted_test_release_identity_and_develop_branch_must_match(self):
        class API:
            def __init__(self, project): self.project = project
            def request(self, resource): return self.project
        project = {'production_branch': 'develop', 'canonical_deployment': {
            'id': 'reviewed-deployment', 'deployment_trigger': {'metadata': {'commit_hash': 'a' * 40, 'branch': 'develop'}}}}
        release.verify_test_deployment(API(project), self.receipt)
        for mutate in (
            lambda p: p.update(production_branch='main'),
            lambda p: p['canonical_deployment'].update(id='later-deployment'),
            lambda p: p['canonical_deployment']['deployment_trigger']['metadata'].update(branch='main'),
            lambda p: p['canonical_deployment']['deployment_trigger']['metadata'].update(commit_hash='c' * 40),
        ):
            wrong = copy.deepcopy(project); mutate(wrong)
            with self.assertRaises(ValueError):
                release.verify_test_deployment(API(wrong), self.receipt)


if __name__ == '__main__':
    unittest.main()

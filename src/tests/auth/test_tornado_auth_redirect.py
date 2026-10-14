import unittest

from parameterized import parameterized

from auth.tornado_auth import sanitize_next_path


class TestSanitizeNextPath(unittest.TestCase):
    @parameterized.expand([
        ('/',),
        ('/index.html',),
        ('/index.html#/My%20Script',),
        ('/admin.html?tab=scripts',),
        ('/scripts/a//b',),
    ])
    def test_internal_path_kept(self, path):
        self.assertEqual(path, sanitize_next_path(path))

    @parameterized.expand([
        (None,),
        ('',),
        ('index.html',),
        ('http://evil.com',),
        ('https://evil.com/path',),
        ('HTTP://evil.com',),
        ('javascript:alert(1)',),
        ('//evil.com',),
        ('//evil.com/index.html',),
        ('/\\evil.com',),
        ('\\\\evil.com',),
        ('/\t/evil.com',),
        ('/\n/evil.com',),
    ])
    def test_external_or_invalid_path_replaced(self, path):
        self.assertEqual('/', sanitize_next_path(path))

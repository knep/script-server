from unittest import TestCase

from parameterized import parameterized

from tests.test_utils import mock_request_handler
from web.web_auth_utils import is_allowed_during_login


class LoginResourcesTest(TestCase):
    @parameterized.expand([
        ('/favicon.ico'),
        ('login.html'),
        # Vite-built hashed bundles served from /assets/ (used by the login page)
        ('/assets/login-jEjOHyEw.js'),
        ('/assets/css-Bn4Yn0er.css'),
        ('/assets/theme-C3Leg-oT.css'),
        ('/assets/MaterialIcons-Regular-Bnsxcfr1.woff'),
        # Custom theme assets (conf/theme/...)
        ('/theme/theme.css'),
        ('/theme/logo.png')
    ])
    def test_is_allowed_during_login_when_allowed(self, resource):
        request_handler = mock_request_handler(method='GET')

        allowed = is_allowed_during_login(resource, 'login.html', request_handler)
        self.assertTrue(allowed, 'Resource ' + resource + ' should be allowed, but was not')

    def test_is_allowed_during_login_when_prohibited(self):
        request_handler = mock_request_handler(method='GET')

        resource = 'admin.html'
        allowed = is_allowed_during_login(resource, 'login.html', request_handler)
        self.assertFalse(allowed, 'Resource ' + resource + ' should NOT be allowed, but WAS')

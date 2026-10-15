import unittest
from unittest.mock import MagicMock

import tornado.web

from auth.identification import InvalidUserHeaderSecretException
from web.web_utils import identify_user


class TestIdentifyUser(unittest.TestCase):
    def test_returns_identified_user(self):
        handler = MagicMock()
        handler.application.identification.identify.return_value = 'user_X'

        self.assertEqual('user_X', identify_user(handler))

    def test_invalid_proxy_secret_is_403(self):
        handler = MagicMock()
        handler.application.identification.identify.side_effect = InvalidUserHeaderSecretException(
            'Missing or invalid X-ScriptServer-Proxy-Secret header')

        with self.assertRaises(tornado.web.HTTPError) as context:
            identify_user(handler)

        self.assertEqual(403, context.exception.status_code)

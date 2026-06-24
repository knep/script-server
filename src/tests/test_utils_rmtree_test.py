import os
import stat
import threading
import time
import unittest

from tests import test_utils


class RmtreeTest(unittest.TestCase):
    """Regression tests for test_utils._rmtree, which used to fail in CI:
    the on-error handler always called os.remove (raising IsADirectoryError on
    directories), and there was no tolerance for files appearing concurrently
    during teardown (upload threads still writing)."""

    def setUp(self):
        self.base = os.path.join(test_utils.temp_folder, 'rmtree_test')
        if os.path.exists(test_utils.temp_folder):
            test_utils._rmtree(test_utils.temp_folder)
        os.makedirs(self.base)

    def tearDown(self):
        if os.path.exists(test_utils.temp_folder):
            test_utils._rmtree(test_utils.temp_folder)

    def _write_file(self, path, content='x'):
        with open(path, 'w') as f:
            f.write(content)

    def test_removes_plain_tree(self):
        os.makedirs(os.path.join(self.base, 'sub', 'deeper'))
        self._write_file(os.path.join(self.base, 'a.txt'))
        self._write_file(os.path.join(self.base, 'sub', 'b.txt'))

        test_utils._rmtree(self.base)

        self.assertFalse(os.path.exists(self.base))

    def test_removes_read_only_file(self):
        # A read-only file triggers on_rm_error; the handler must chmod and
        # re-run the unlink (the original behaviour this helper was written for).
        ro_file = os.path.join(self.base, 'readonly.txt')
        self._write_file(ro_file)
        os.chmod(ro_file, stat.S_IREAD)

        test_utils._rmtree(self.base)

        self.assertFalse(os.path.exists(self.base))

    def test_tolerates_concurrent_writer(self):
        # Reproduces the CI race: a background thread keeps creating files in the
        # tree while _rmtree runs. With the buggy handler this raised
        # IsADirectoryError; now the retry loop absorbs it and eventually wins
        # once the writer stops (well within the ~1s retry budget).
        stop = threading.Event()

        def writer():
            i = 0
            while not stop.is_set() and i < 8:
                try:
                    os.makedirs(self.base, exist_ok=True)
                    self._write_file(os.path.join(self.base, 'race_%d.bin' % i))
                except OSError:
                    pass
                i += 1
                time.sleep(0.02)

        thread = threading.Thread(target=writer)
        thread.start()
        try:
            time.sleep(0.03)  # let the writer get going before we start removing
            test_utils._rmtree(self.base)
        finally:
            stop.set()
            thread.join()

        # After the writer stopped, a final removal must leave nothing behind.
        if os.path.exists(self.base):
            test_utils._rmtree(self.base)
        self.assertFalse(os.path.exists(self.base))


if __name__ == '__main__':
    unittest.main()

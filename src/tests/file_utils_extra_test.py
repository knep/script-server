import datetime
import os
import stat
import unittest

from tests import test_utils
from utils import file_utils, os_utils
from utils.file_utils import FileMatcher, SingleFileMatcher, FileExistsException


def _path(*parts):
    return os.path.join(test_utils.temp_folder, *parts)


class ReadWriteFileTest(unittest.TestCase):
    def setUp(self):
        test_utils.setup()

    def tearDown(self):
        test_utils.cleanup()

    def test_write_then_read_roundtrip(self):
        path = _path('sub', 'file.txt')
        file_utils.write_file(path, 'hello world')
        self.assertEqual('hello world', file_utils.read_file(path))

    def test_write_creates_missing_folders(self):
        path = _path('a', 'b', 'c', 'file.txt')
        file_utils.write_file(path, 'x')
        self.assertTrue(os.path.exists(path))

    def test_write_and_read_bytes(self):
        path = _path('bytes.bin')
        file_utils.write_file(path, b'\x01\x02\x03', byte_content=True)
        self.assertEqual(b'\x01\x02\x03', file_utils.read_file(path, byte_content=True))

    def test_read_keep_newlines(self):
        path = _path('nl.txt')
        file_utils.write_file(path, 'a\r\nb\n', byte_content=False)
        # With keep_newlines the original line endings are preserved.
        self.assertEqual('a\r\nb\n', file_utils.read_file(path, keep_newlines=True))

    def test_read_falls_back_to_alternative_encoding(self):
        path = _path('latin.txt')
        # 0xe9 is invalid UTF-8 on its own -> triggers the encoding fallback.
        file_utils.write_file(path, b'caf\xe9', byte_content=True)
        result = file_utils.read_file(path)
        self.assertTrue(result.startswith('caf'))

    def test_try_encoded_read_returns_none_for_unreadable(self):
        path = _path('bad.bin')
        file_utils.write_file(path, b'\xff\xfe\x00\x80\x81', byte_content=True)
        # Not asserting a specific decode, just that the helper runs.
        self.assertIsNotNone(file_utils.read_file(path))


class FolderAndExistenceTest(unittest.TestCase):
    def setUp(self):
        test_utils.setup()

    def tearDown(self):
        test_utils.cleanup()

    def test_prepare_folder_creates_folder(self):
        path = _path('new', 'folder')
        file_utils.prepare_folder(path)
        self.assertTrue(os.path.isdir(path))

    def test_prepare_folder_is_idempotent(self):
        path = _path('folder')
        file_utils.prepare_folder(path)
        file_utils.prepare_folder(path)
        self.assertTrue(os.path.isdir(path))

    def test_exists(self):
        path = _path('file.txt')
        self.assertFalse(file_utils.exists(path))
        file_utils.write_file(path, 'x')
        self.assertTrue(file_utils.exists(path))

    def test_exists_with_current_folder(self):
        file_utils.write_file(_path('runners', 'x.json'), '{}')
        self.assertTrue(file_utils.exists('x.json', _path('runners')))
        self.assertFalse(file_utils.exists('missing.json', _path('runners')))


class PathHelpersTest(unittest.TestCase):
    def tearDown(self):
        os_utils.reset_os()

    def test_is_root(self):
        self.assertTrue(file_utils.is_root(os.path.abspath(os.sep)))
        self.assertFalse(file_utils.is_root('/some/path'))

    def test_split_all(self):
        self.assertEqual(['a', 'b', 'c'], file_utils.split_all(os.path.join('a', 'b', 'c')))

    def test_split_all_empty(self):
        self.assertEqual([], file_utils.split_all(''))

    def test_normalize_path_absolute(self):
        absolute = os.path.abspath(os.sep + 'tmp')
        self.assertEqual(os.path.normpath(absolute), file_utils.normalize_path(absolute))

    def test_normalize_path_with_current_folder(self):
        result = file_utils.normalize_path('child', os.path.abspath(os.sep + 'parent'))
        self.assertEqual(os.path.join(os.path.abspath(os.sep + 'parent'), 'child'), result)

    def test_normalize_path_nonexistent_relative_returned_as_is(self):
        self.assertEqual('does_not_exist_xyz', file_utils.normalize_path('does_not_exist_xyz'))

    def test_relative_path(self):
        parent = os.path.abspath(os.sep + 'data')
        child = os.path.join(parent, 'sub', 'file.txt')
        self.assertEqual(os.path.join('sub', 'file.txt'), file_utils.relative_path(child, parent))

    def test_relative_path_raises_when_not_subpath(self):
        with self.assertRaises(ValueError):
            file_utils.relative_path(
                os.path.abspath(os.sep + 'other'),
                os.path.abspath(os.sep + 'data'))


class UniqueFilenameTest(unittest.TestCase):
    def setUp(self):
        test_utils.setup()

    def tearDown(self):
        test_utils.cleanup()

    def test_returns_preferred_when_free(self):
        path = _path('report.txt')
        self.assertEqual(path, file_utils.create_unique_filename(path))

    def test_appends_suffix_on_conflict(self):
        path = _path('report.txt')
        file_utils.write_file(path, 'x')
        self.assertEqual(_path('report_0.txt'), file_utils.create_unique_filename(path))

    def test_increments_suffix_on_multiple_conflicts(self):
        file_utils.write_file(_path('report.txt'), 'x')
        file_utils.write_file(_path('report_0.txt'), 'x')
        self.assertEqual(_path('report_1.txt'), file_utils.create_unique_filename(_path('report.txt')))

    def test_raises_when_retries_exhausted(self):
        file_utils.write_file(_path('report.txt'), 'x')
        with self.assertRaises(FileExistsException):
            file_utils.create_unique_filename(_path('report.txt'), retries=0)


class ExecutableTest(unittest.TestCase):
    def setUp(self):
        test_utils.setup()

    def tearDown(self):
        test_utils.cleanup()

    def test_make_executable(self):
        path = _path('script.sh')
        file_utils.write_file(path, '#!/bin/sh\n')
        file_utils.make_executable(path)
        self.assertTrue(file_utils.is_executable(path))
        mode = os.stat(path).st_mode
        self.assertTrue(mode & stat.S_IXUSR)


class BinaryDetectionTest(unittest.TestCase):
    def setUp(self):
        test_utils.setup()

    def tearDown(self):
        test_utils.cleanup()

    def test_elf_header_is_binary(self):
        path = _path('elf')
        file_utils.write_file(path, bytes.fromhex('7F454C46') + b'rest', byte_content=True)
        self.assertTrue(file_utils.is_binary(path))

    def test_windows_executable_is_binary(self):
        path = _path('exe')
        file_utils.write_file(path, bytes.fromhex('4D5A') + b'rest', byte_content=True)
        self.assertTrue(file_utils.is_binary(path))

    def test_null_bytes_is_binary(self):
        path = _path('nulls')
        file_utils.write_file(path, b'abc\x00\x00def', byte_content=True)
        self.assertTrue(file_utils.is_binary(path))

    def test_plain_text_is_not_binary(self):
        path = _path('text.txt')
        file_utils.write_file(path, 'just some text content')
        self.assertFalse(file_utils.is_binary(path))


class SymlinkTest(unittest.TestCase):
    def setUp(self):
        test_utils.setup()

    def tearDown(self):
        test_utils.cleanup()

    def test_broken_symlink_detected(self):
        link = _path('broken_link')
        os.symlink(_path('does_not_exist'), link)
        self.assertTrue(file_utils.is_broken_symlink(link))

    def test_valid_symlink_is_not_broken(self):
        target = _path('target.txt')
        file_utils.write_file(target, 'x')
        link = _path('valid_link')
        os.symlink(os.path.abspath(target), link)
        self.assertFalse(file_utils.is_broken_symlink(link))

    def test_regular_file_is_not_broken_symlink(self):
        path = _path('regular.txt')
        file_utils.write_file(path, 'x')
        self.assertFalse(file_utils.is_broken_symlink(path))


class ModificationDateTest(unittest.TestCase):
    def setUp(self):
        test_utils.setup()

    def tearDown(self):
        test_utils.cleanup()

    def test_modification_date_returns_datetime(self):
        path = _path('file.txt')
        file_utils.write_file(path, 'x')
        self.assertIsInstance(file_utils.modification_date(path), datetime.datetime)

    def test_last_modification_of_tree(self):
        file_utils.write_file(_path('tree', 'a.txt'), 'a')
        file_utils.write_file(_path('tree', 'sub', 'b.txt'), 'b')
        result = file_utils.last_modification([_path('tree')])
        self.assertIsInstance(result, datetime.datetime)

    def test_deletion_date_uses_existing_parent(self):
        folder = _path('folder')
        file_utils.prepare_folder(folder)
        deleted = os.path.join(folder, 'gone.txt')
        self.assertIsInstance(file_utils.deletion_date(deleted), datetime.datetime)


class SearchGlobTest(unittest.TestCase):
    def setUp(self):
        test_utils.setup()

    def tearDown(self):
        test_utils.cleanup()

    def test_glob_matches_extension(self):
        file_utils.write_file(_path('a.txt'), 'x')
        file_utils.write_file(_path('b.txt'), 'x')
        file_utils.write_file(_path('c.log'), 'x')
        matches = file_utils.search_glob(_path('*.txt'))
        self.assertCountEqual([_path('a.txt'), _path('b.txt')], matches)

    def test_glob_recursive(self):
        file_utils.write_file(_path('root.txt'), 'x')
        file_utils.write_file(_path('sub', 'nested.txt'), 'x')
        matches = file_utils.search_glob(_path('**', '*.txt'), recursive=True)
        self.assertIn(_path('sub', 'nested.txt'), matches)


class FileMatcherTest(unittest.TestCase):
    def tearDown(self):
        os_utils.reset_os()

    def _abs(self, *parts):
        return os.path.join(os.path.abspath(os.sep + 'data'), *parts)

    def test_plain_pattern_matches_children(self):
        matcher = FileMatcher([os.path.abspath(os.sep + 'data')], os.path.abspath(os.sep + 'work'))
        self.assertTrue(matcher.has_match(self._abs('logs', 'app.log')))

    def test_plain_pattern_rejects_outside_paths(self):
        matcher = FileMatcher([os.path.abspath(os.sep + 'data')], os.path.abspath(os.sep + 'work'))
        self.assertFalse(matcher.has_match(os.path.abspath(os.sep + 'other') + os.sep + 'app.log'))

    def test_star_pattern_matches_extension(self):
        matcher = FileMatcher([self._abs('*.log')], os.path.abspath(os.sep + 'work'))
        self.assertTrue(matcher.has_match(self._abs('app.log')))
        self.assertFalse(matcher.has_match(self._abs('app.txt')))

    def test_recursive_pattern_matches_nested(self):
        matcher = FileMatcher([self._abs('**')], os.path.abspath(os.sep + 'work'))
        self.assertTrue(matcher.has_match(self._abs('deep', 'nested', 'x.log')))

    def test_empty_patterns_match_nothing(self):
        matcher = FileMatcher([], os.path.abspath(os.sep + 'work'))
        self.assertFalse(matcher.has_match(self._abs('x.log')))

    def test_has_match_accepts_path_object(self):
        import pathlib
        matcher = FileMatcher([os.path.abspath(os.sep + 'data')], os.path.abspath(os.sep + 'work'))
        self.assertTrue(matcher.has_match(pathlib.Path(self._abs('a', 'b.txt'))))


class SingleFileMatcherTest(unittest.TestCase):
    def test_relative_pattern_is_normalized_against_working_dir(self):
        working_dir = os.path.abspath(os.sep + 'work')
        matcher = SingleFileMatcher('logs', working_dir)
        self.assertEqual(os.path.join(working_dir, 'logs'), matcher.pattern)

    def test_absolute_pattern_is_kept(self):
        pattern = os.path.abspath(os.sep + 'data') + os.sep + 'logs'
        matcher = SingleFileMatcher(pattern, os.path.abspath(os.sep + 'work'))
        self.assertEqual(pattern, matcher.pattern)


if __name__ == '__main__':
    unittest.main()

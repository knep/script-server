import json
import os
import unittest

from migrations import migrate
from tests import test_utils
from utils import file_utils
from execution.logging import OUTPUT_STARTED_MARKER


def _all_migration_ids():
    # The registry name is module-private; getattr with a literal string avoids
    # the name mangling that a direct ``migrate.__migrations_registry`` would
    # trigger inside this class body.
    return list(getattr(migrate, '__migrations_registry').keys())


class MigrateTestBase(unittest.TestCase):
    def setUp(self):
        test_utils.setup()

        base = test_utils.temp_folder
        self.temp_dir = os.path.join(base, 'state')
        self.conf_dir = os.path.join(base, 'conf')
        self.conf_file = os.path.join(self.conf_dir, 'conf.json')
        self.log_dir = os.path.join(base, 'log')

        for folder in (self.temp_dir, self.conf_dir, self.log_dir):
            os.makedirs(folder)

    def tearDown(self):
        test_utils.cleanup()

    def _run_migrate(self):
        migrate.migrate(self.temp_dir, self.conf_dir, self.conf_file, self.log_dir)

    def _run_only(self, migration_id):
        """Mark every migration except ``migration_id`` as already applied, so a
        single call to migrate() runs exactly the targeted migration."""
        already_applied = [m for m in _all_migration_ids() if m != migration_id]
        migrate._write_migrations(self.temp_dir, already_applied)
        self._run_migrate()

    def _mark_all_applied(self):
        migrate._write_migrations(self.temp_dir, _all_migration_ids())

    def _write_conf(self, obj):
        file_utils.write_file(self.conf_file, json.dumps(obj))

    def _read_conf(self):
        return json.loads(file_utils.read_file(self.conf_file))

    def _write_runner(self, name, obj):
        path = os.path.join(self.conf_dir, 'runners', name + '.json')
        file_utils.write_file(path, json.dumps(obj))
        return path

    def _read_runner(self, name):
        path = os.path.join(self.conf_dir, 'runners', name + '.json')
        return json.loads(file_utils.read_file(path))

    def _write_log(self, filename, content):
        processes = os.path.join(self.log_dir, 'processes')
        path = os.path.join(processes, filename)
        file_utils.write_file(path, content)
        return path

    def _read_migrations_file(self):
        return migrate._read_old_migrations(self.temp_dir)


class OrchestrationTest(MigrateTestBase):
    def test_new_installation_marks_all_applied(self):
        # Both temp and conf folders are empty -> treated as a fresh install:
        # all migrations are recorded as done without transforming anything.
        self._run_migrate()

        self.assertCountEqual(_all_migration_ids(), self._read_migrations_file())

    def test_new_installation_does_not_transform_data(self):
        # conf folder stays empty so the install is still considered new; a log
        # file that would otherwise be migrated must be left untouched.
        self._write_log('old.log', 'raw output')
        self._run_migrate()

        self.assertEqual('raw output', file_utils.read_file(
            os.path.join(self.log_dir, 'processes', 'old.log')))

    def test_already_migrated_is_noop(self):
        self._mark_all_applied()
        path = self._write_runner('x', {'bash_formatting': False})

        self._run_migrate()

        self.assertEqual({'bash_formatting': False}, self._read_runner('x'))

    def test_runs_all_pending_when_nothing_applied(self):
        # conf_file present -> not a new installation, so every migration runs
        # (most are no-ops here) and all ids end up recorded.
        self._write_conf({'something': 'value'})
        migrate._write_migrations(self.temp_dir, [])

        self._run_migrate()

        self.assertCountEqual(_all_migration_ids(), self._read_migrations_file())

    def test_unknown_requirement_raises(self):
        registry = getattr(migrate, '__migrations_registry')
        descriptor_cls = getattr(migrate, '_MigrationDescriptor')
        registry['broken'] = descriptor_cls('broken', lambda ctx: None, 'broken', ['does_not_exist'])
        try:
            with self.assertRaises(Exception):
                migrate._validate_requirements()
        finally:
            del registry['broken']


class AddExecutionInfoToLogFilesTest(MigrateTestBase):
    migration_id = 'add_execution_info_to_log_files'

    def test_old_file_gets_header_with_parsed_name(self):
        self._write_log('myscript_bob_200115_103000.log', 'hello world')

        self._run_only(self.migration_id)

        content = file_utils.read_file(
            os.path.join(self.log_dir, 'processes', 'myscript_bob_200115_103000.log'))
        self.assertTrue(content.startswith('id:'))
        self.assertIn('script:myscript', content)
        self.assertIn('user_name:bob', content)
        self.assertIn('user_id:bob', content)
        self.assertIn(OUTPUT_STARTED_MARKER, content)
        self.assertTrue(content.endswith('hello world'))

    def test_unparseable_name_uses_unknown(self):
        self._write_log('weirdname.log', 'body')

        self._run_only(self.migration_id)

        content = file_utils.read_file(
            os.path.join(self.log_dir, 'processes', 'weirdname.log'))
        self.assertIn('script:unknown', content)
        self.assertIn('user_name:unknown', content)

    def test_new_format_file_is_left_untouched(self):
        original = 'id:5' + os.linesep + OUTPUT_STARTED_MARKER + os.linesep + 'output'
        self._write_log('already_new.log', original)

        self._run_only(self.migration_id)

        self.assertEqual(original, file_utils.read_file(
            os.path.join(self.log_dir, 'processes', 'already_new.log')))

    def test_missing_processes_folder_is_noop(self):
        # No processes folder at all -> migration returns without error.
        self._run_only(self.migration_id)


class AddUserIdToLogFilesTest(MigrateTestBase):
    migration_id = 'add_user_id_to_log_files'

    def _log_content(self, params_lines):
        params = os.linesep.join(params_lines) + os.linesep
        return params + OUTPUT_STARTED_MARKER + os.linesep + 'the output'

    def test_user_id_and_name_are_added(self):
        content = self._log_content(['id:7', 'user:bob'])
        self._write_log('run.log', content)

        self._run_only(self.migration_id)

        migrated = file_utils.read_file(
            os.path.join(self.log_dir, 'processes', 'run.log'))
        self.assertIn('user_id:bob', migrated)
        self.assertIn('user_name:bob', migrated)
        self.assertTrue(migrated.endswith('the output'))

    def test_file_with_both_fields_is_untouched(self):
        content = self._log_content(['id:7', 'user:bob', 'user_id:bob', 'user_name:bob'])
        self._write_log('run.log', content)

        self._run_only(self.migration_id)

        self.assertEqual(content, file_utils.read_file(
            os.path.join(self.log_dir, 'processes', 'run.log')))


class IntroduceAccessConfigTest(MigrateTestBase):
    migration_id = 'introduce_access_config'

    def test_fields_moved_under_access(self):
        self._write_conf({
            'auth': {'type': 'ldap', 'allowed_users': ['u1']},
            'admin_users': ['admin1'],
            'trusted_ips': ['127.0.0.1'],
        })

        self._run_only(self.migration_id)

        result = self._read_conf()
        self.assertEqual(['u1'], result['access']['allowed_users'])
        self.assertEqual(['admin1'], result['access']['admin_users'])
        self.assertEqual(['127.0.0.1'], result['access']['trusted_ips'])
        self.assertNotIn('allowed_users', result['auth'])
        self.assertNotIn('admin_users', result)
        self.assertNotIn('trusted_ips', result)

    def test_no_relevant_fields_leaves_file_unchanged(self):
        self._write_conf({'auth': {'type': 'ldap'}})

        self._run_only(self.migration_id)

        self.assertEqual({'auth': {'type': 'ldap'}}, self._read_conf())

    def test_missing_conf_file_is_noop(self):
        self._run_only(self.migration_id)

    def test_existing_indentation_is_preserved(self):
        # File written with 2-space indentation -> rewrite keeps that indent.
        file_utils.write_file(self.conf_file, json.dumps(
            {'admin_users': ['admin1']}, indent=2))

        self._run_only(self.migration_id)

        raw = file_utils.read_file(self.conf_file)
        self.assertIn('\n  "access"', raw)
        self.assertEqual(['admin1'], self._read_conf()['access']['admin_users'])


class OutputFilesParametersSubstitutionTest(MigrateTestBase):
    migration_id = 'migrate_output_files_parameters_substitution'

    def test_dollar_syntax_is_rewritten(self):
        self._write_runner('script', {
            'parameters': [{'name': 'param1'}],
            'output_files': ['report_$$$param1.txt'],
        })

        self._run_only(self.migration_id)

        self.assertEqual(['report_${param1}.txt'], self._read_runner('script')['output_files'])

    def test_runner_without_output_files_is_untouched(self):
        self._write_runner('script', {'parameters': [{'name': 'param1'}]})

        self._run_only(self.migration_id)

        self.assertEqual({'parameters': [{'name': 'param1'}]}, self._read_runner('script'))


class BashFormattingToOutputFormatTest(MigrateTestBase):
    migration_id = 'migrate_bash_formatting_to_output_format'

    def test_bash_formatting_false_becomes_text(self):
        self._write_runner('script', {'bash_formatting': False})

        self._run_only(self.migration_id)

        result = self._read_runner('script')
        self.assertNotIn('bash_formatting', result)
        self.assertEqual('text', result['output_format'])

    def test_bash_formatting_true_becomes_terminal(self):
        self._write_runner('script', {'bash_formatting': True})

        self._run_only(self.migration_id)

        self.assertEqual('terminal', self._read_runner('script')['output_format'])


class RepeatParamAndSameArgParamTest(MigrateTestBase):
    migration_id = 'migrate_repeat_param_and_same_arg_param'

    def test_repeat_param_true_is_converted(self):
        self._write_runner('script', {'parameters': [{'name': 'p', 'repeat_param': True}]})

        self._run_only(self.migration_id)

        param = self._read_runner('script')['parameters'][0]
        self.assertNotIn('repeat_param', param)
        self.assertEqual(False, param['same_arg_param'])

    def test_multiple_arguments_becomes_argument_per_value(self):
        self._write_runner('script', {'parameters': [{'name': 'p', 'multiple_arguments': True}]})

        self._run_only(self.migration_id)

        param = self._read_runner('script')['parameters'][0]
        self.assertNotIn('multiple_arguments', param)
        self.assertEqual('argument_per_value', param['multiselect_argument_type'])

    def test_param_without_legacy_fields_is_untouched(self):
        self._write_runner('script', {'parameters': [{'name': 'p', 'type': 'int'}]})

        self._run_only(self.migration_id)

        self.assertEqual([{'name': 'p', 'type': 'int'}], self._read_runner('script')['parameters'])


class LdapUsernamePatternToUserResolverTest(MigrateTestBase):
    migration_id = 'migrate_ldap_username_pattern_to_user_resolver'

    def test_username_pattern_moved_into_resolver(self):
        self._write_conf({'auth': {'type': 'ldap', 'username_pattern': 'uid=$username'}})

        self._run_only(self.migration_id)

        auth = self._read_conf()['auth']
        self.assertNotIn('username_pattern', auth)
        self.assertEqual('uid=$username', auth['ldap_user_resolver']['username_pattern'])

    def test_non_ldap_auth_is_untouched(self):
        self._write_conf({'auth': {'type': 'google_oauth', 'username_pattern': 'x'}})

        self._run_only(self.migration_id)

        self.assertEqual({'auth': {'type': 'google_oauth', 'username_pattern': 'x'}}, self._read_conf())

    def test_already_migrated_resolver_is_untouched(self):
        config = {'auth': {'type': 'ldap', 'username_pattern': 'a',
                           'ldap_user_resolver': {'username_pattern': 'b'}}}
        self._write_conf(config)

        self._run_only(self.migration_id)

        self.assertEqual(config, self._read_conf())


if __name__ == '__main__':
    unittest.main()

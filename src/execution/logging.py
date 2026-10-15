# noinspection PyBroadException
import base64
import binascii
import heapq
import json
import logging
import os
import re
from datetime import datetime, timezone
from string import Template
from typing import List, Optional

from auth.authorization import is_same_user
from execution.execution_service import ExecutionService
from model import model_helper
from model.model_helper import AccessProhibitedException
from model.server_conf import LoggingConfig
from utils import file_utils, audit_utils
from utils.audit_utils import get_audit_name
from utils.collection_utils import get_first_existing
from utils.date_utils import get_current_millis, ms_to_datetime, to_millis

ENCODING = 'utf8'

OUTPUT_STARTED_MARKER = '>>>>>  OUTPUT STARTED <<<<<'

SORT_START_TIME = 'startTime'
SORT_ID = 'id'
SORT_USER = 'user'
SORT_SCRIPT = 'script'
SORTABLE_FIELDS = (SORT_START_TIME, SORT_ID, SORT_USER, SORT_SCRIPT)

ORDER_ASC = 'asc'
ORDER_DESC = 'desc'
SORT_ORDERS = (ORDER_ASC, ORDER_DESC)

MAX_PAGE_LIMIT = 500

_MIN_DATETIME = datetime.min.replace(tzinfo=timezone.utc)

LOGGER = logging.getLogger('script_server.execution.logging')


class InvalidCursorException(Exception):
    pass


class ScriptOutputLogger:
    def __init__(self, log_file_path, output_stream):
        self.opened = False
        self.closed = False
        self.output_stream = output_stream

        self.log_file_path = log_file_path
        self.log_file = None
        self.close_callback = None

    def start(self):
        self._ensure_file_open()

        self.output_stream.subscribe(self)

    def _ensure_file_open(self):
        if self.opened:
            return

        try:
            self.log_file = open(self.log_file_path, 'wb')
        except:
            LOGGER.exception("Couldn't create a log file")

        self.opened = True

    def __log(self, text):
        if not self.opened:
            LOGGER.exception('Attempt to write to not opened logger')
            return

        if not self.log_file:
            return

        try:
            if text is not None:
                self.log_file.write(text.encode(ENCODING))
                self.log_file.flush()
        except:
            LOGGER.exception("Couldn't write to the log file")

    def _close(self):
        try:
            if self.log_file:
                self.log_file.close()
        except:
            LOGGER.exception("Couldn't close the log file")

        self.closed = True

        if self.close_callback:
            self.close_callback()

    def on_next(self, output):
        self.__log(output)

    def on_close(self):
        self._close()

    def write_line(self, text):
        self._ensure_file_open()

        self.__log(text + os.linesep)

    def set_close_callback(self, callback):
        if self.close_callback is not None:
            LOGGER.error('Attempt to override close callback ' + repr(self.close_callback) + ' with ' + repr(callback))
            return

        self.close_callback = callback

        if self.closed:
            self.close_callback()


class HistoryEntry:
    def __init__(self):
        self.user_name = None
        self.user_id = None
        self.start_time = None
        self.script_name = None
        self.command = None
        self.output_format = None
        self.id = None
        self.exit_code = None


class HistoryEntrySummary:
    """Everything needed to list, sort, search and access-check an execution, without its command.

    One instance per known execution stays in memory for the lifetime of the process, so the
    unbounded fields (command, output format) are left out and read from the log file on demand.
    """

    __slots__ = ('id', 'user_name', 'user_id', 'start_time', 'script_name', 'exit_code')

    def __init__(self, id, user_name, user_id, start_time, script_name, exit_code):
        self.id = id
        self.user_name = user_name
        self.user_id = user_id
        self.start_time = start_time
        self.script_name = script_name
        self.exit_code = exit_code


class HistoryPage:
    def __init__(self, records, total, next_cursor):
        self.records = records
        self.total = total
        self.next_cursor = next_cursor


class _IndexedLog:
    __slots__ = ('filename', 'summary')

    def __init__(self, filename, summary):
        self.filename = filename
        self.summary = summary


class ExecutionLoggingService:
    def __init__(self, output_folder, log_name_creator, authorizer):
        self._output_folder = output_folder
        self._log_name_creator = log_name_creator
        self._authorizer = authorizer

        self._visited_files = set()
        self._logs_by_id = {}
        self._output_loggers = {}

        file_utils.prepare_folder(output_folder)

        self._renew_files_cache()

    def start_logging(self, execution_id,
                      user_name,
                      user_id,
                      command,
                      output_stream,
                      all_audit_names,
                      script_config,
                      parameter_value_wrappers,
                      start_time_millis=None):
        
        if script_config.logging_config:
            if not script_config.logging_config.enabled:
                LOGGER.info(f'Logging is disabled for script {script_config.name}, skipping log creation')
                return

        script_name = str(script_config.name)

        if start_time_millis is None:
            start_time_millis = get_current_millis()

        log_filename = self._log_name_creator.create_filename(
            execution_id,
            all_audit_names,
            script_name,
            start_time_millis,
            script_config.logging_config,
            script_config.parameters,
            parameter_value_wrappers)
        log_file_path = os.path.join(self._output_folder, log_filename)
        log_file_path = file_utils.create_unique_filename(log_file_path)

        output_logger = ScriptOutputLogger(log_file_path, output_stream)
        output_logger.write_line('id:' + execution_id)
        output_logger.write_line('user_name:' + user_name)
        output_logger.write_line('user_id:' + user_id)
        output_logger.write_line('script:' + script_name)
        output_logger.write_line('start_time:' + str(start_time_millis))
        output_logger.write_line('command:' + command)
        output_logger.write_line('output_format:' + script_config.output_format)
        output_logger.write_line(OUTPUT_STARTED_MARKER)
        output_logger.start()

        log_filename = os.path.basename(log_file_path)
        self._visited_files.add(log_filename)
        self._logs_by_id[execution_id] = _IndexedLog(log_filename, HistoryEntrySummary(
            id=execution_id,
            user_name=user_name,
            user_id=user_id,
            start_time=ms_to_datetime(start_time_millis),
            script_name=script_name,
            exit_code=None))
        self._output_loggers[execution_id] = output_logger

    def write_post_execution_info(self, execution_id, exit_code):
        indexed_log = self._logs_by_id.get(execution_id)
        if not indexed_log:
            LOGGER.warning('Failed to find filename for execution ' + execution_id)
            return

        logger = self._output_loggers.get(execution_id)
        if not logger:
            LOGGER.warning('Failed to find logger for execution ' + execution_id)
            return

        log_file_path = os.path.join(self._output_folder, indexed_log.filename)

        def close_callback():
            self._write_post_execution_info(log_file_path, exit_code)
            indexed_log.summary.exit_code = int(exit_code) if exit_code is not None else None

        logger.set_close_callback(close_callback)

    def get_history_entries(self, user_id, *, system_call=False) -> List[HistoryEntrySummary]:
        self._renew_files_cache()

        return [log.summary for log in self._logs_by_id.values()
                if self._can_access(log.summary.user_id, user_id, system_call)]

    def get_history_page(self,
                         user_id,
                         *,
                         system_call=False,
                         search=None,
                         sort=None,
                         order=None,
                         limit=None,
                         after=None) -> HistoryPage:
        """Return a single page of history entries, newest first by default.

        search: case-insensitive substring, matched against the script name or the user name
        sort/order: see SORTABLE_FIELDS and SORT_ORDERS
        limit: page size, 1..MAX_PAGE_LIMIT; None returns every matching entry
        after: cursor from a previous page's next_cursor; must have been produced for the same
               sort and order, otherwise InvalidCursorException is raised

        total counts everything the user may see for this search, regardless of the cursor.
        """

        self._renew_files_cache()

        sort = sort if sort is not None else SORT_START_TIME
        order = order if order is not None else ORDER_DESC

        if sort not in SORTABLE_FIELDS:
            raise ValueError('Unsupported sort field: ' + str(sort))
        if order not in SORT_ORDERS:
            raise ValueError('Unsupported sort order: ' + str(order))
        if limit is not None and (limit < 1 or limit > MAX_PAGE_LIMIT):
            raise ValueError('limit should be between 1 and ' + str(MAX_PAGE_LIMIT))

        cursor_key = _decode_cursor(after, sort, order) if after else None
        descending = order == ORDER_DESC
        search_text = search.strip().lower() if search else None

        total = 0
        candidates = []
        for indexed_log in self._logs_by_id.values():
            summary = indexed_log.summary

            if not self._can_access(summary.user_id, user_id, system_call):
                continue

            if search_text and not _matches_search(summary, search_text):
                continue

            total += 1

            sort_key = _sort_key(summary, sort)
            if cursor_key is not None and not _is_after_cursor(sort_key, cursor_key, descending):
                continue

            candidates.append((sort_key, summary))

        if limit is None:
            candidates.sort(key=_candidate_key, reverse=descending)
            return HistoryPage([summary for _, summary in candidates], total, None)

        if descending:
            page = heapq.nlargest(limit, candidates, key=_candidate_key)
        else:
            page = heapq.nsmallest(limit, candidates, key=_candidate_key)

        has_more = len(candidates) > limit
        next_cursor = _encode_cursor(page[-1][1], sort, order) if (has_more and page) else None

        return HistoryPage([summary for _, summary in page], total, next_cursor)

    def find_history_entry(self, execution_id, user_id) -> Optional[HistoryEntry]:
        self._renew_files_cache()

        indexed_log = self._logs_by_id.get(execution_id)
        if indexed_log is None:
            LOGGER.warning('find_history_entry: file for %s id not found', execution_id)
            return None

        if not self._can_access(indexed_log.summary.user_id, user_id):
            message = 'User ' + user_id + ' has no access to execution #' + str(execution_id)
            LOGGER.warning('%s. Original user: %s', message, indexed_log.summary.user_id)
            raise AccessProhibitedException(message)

        entry = self._extract_history_entry(indexed_log.filename)
        if entry is None:
            LOGGER.warning('find_history_entry: cannot parse file for %s', execution_id)

        return entry

    def find_log(self, execution_id):
        self._renew_files_cache()

        indexed_log = self._logs_by_id.get(execution_id)
        if indexed_log is None:
            LOGGER.warning('find_log: file for %s id not found', execution_id)
            return None

        file_content = file_utils.read_file(os.path.join(self._output_folder, indexed_log.filename),
                                            keep_newlines=True)
        log = file_content.split(OUTPUT_STARTED_MARKER, 1)[1]
        return _lstrip_any_linesep(log)

    def _extract_history_entry(self, file):
        file_path = os.path.join(self._output_folder, file)
        correct_format, parameters_text = self._read_parameters_text(file_path)
        if not correct_format:
            return None
        parameters = self._parse_history_parameters(parameters_text)
        return self._parameters_to_entry(parameters)

    @staticmethod
    def _read_parameters_text(file_path):
        parameters_text = ''
        correct_format = False
        with open(file_path, 'r', encoding=ENCODING) as f:
            for line in f:
                if _rstrip_once(line, '\n') == OUTPUT_STARTED_MARKER:
                    correct_format = True
                    break
                parameters_text += line
        return correct_format, parameters_text

    def _renew_files_cache(self):
        index = self._logs_by_id

        obsolete_ids = []
        for id, indexed_log in index.items():
            path = os.path.join(self._output_folder, indexed_log.filename)
            if not os.path.exists(path):
                obsolete_ids.append(id)

        for obsolete_id in obsolete_ids:
            LOGGER.info('Logs for execution #' + obsolete_id + ' were deleted')
            del index[obsolete_id]

        for file in os.listdir(self._output_folder):
            if not file.lower().endswith('.log'):
                continue

            if file in self._visited_files:
                continue

            self._visited_files.add(file)

            entry = self._extract_history_entry(file)
            if entry is None:
                continue

            index[entry.id] = _IndexedLog(file, _to_summary(entry))

    @staticmethod
    def _create_log_identifier(audit_name, script_name, start_time):
        audit_name = file_utils.to_filename(audit_name)

        date_string = ms_to_datetime(start_time).strftime("%y%m%d_%H%M%S")

        script_name = script_name.replace(" ", "_")
        log_identifier = script_name + "_" + audit_name + "_" + date_string
        return log_identifier

    @staticmethod
    def _parse_history_parameters(parameters_text):
        current_value = None
        current_key = None

        parameters = {}
        for line in parameters_text.splitlines(keepends=True):
            match = re.fullmatch(r'([\w_]+):(.*\r?\n)', line)
            if not match:
                current_value += line
                continue

            if current_key is not None:
                parameters[current_key] = _rstrip_once(current_value, '\n')

            current_key = match.group(1)
            current_value = match.group(2)

        if current_key is not None:
            parameters[current_key] = _rstrip_once(current_value, '\n')

        return parameters

    @staticmethod
    def _parameters_to_entry(parameters):
        id = parameters.get('id')
        if not id:
            return None

        entry = HistoryEntry()
        entry.id = id
        entry.script_name = parameters.get('script')
        entry.user_name = parameters.get('user_name')
        entry.user_id = parameters.get('user_id')
        entry.command = parameters.get('command')
        entry.output_format = parameters.get('output_format')

        exit_code = parameters.get('exit_code')
        if exit_code is not None:
            entry.exit_code = int(exit_code)

        start_time = parameters.get('start_time')
        if start_time:
            entry.start_time = ms_to_datetime(int(start_time))

        return entry

    @staticmethod
    def _write_post_execution_info(log_file_path, exit_code):
        file_content = file_utils.read_file(log_file_path, keep_newlines=True)

        file_parts = file_content.split(OUTPUT_STARTED_MARKER + os.linesep, 1)
        parameters_text = file_parts[0]
        parameters_text += 'exit_code:' + str(exit_code) + os.linesep

        new_content = parameters_text + OUTPUT_STARTED_MARKER + os.linesep + file_parts[1]
        file_utils.write_file(log_file_path, new_content.encode(ENCODING), byte_content=True)

    def _can_access(self, entry_user_id, user_id, system_call=False):
        if is_same_user(entry_user_id, user_id):
            return True

        if system_call:
            return True

        return self._authorizer.has_full_history_access(user_id)


class LogNameCreator:
    def __init__(self, filename_pattern=None, date_format=None) -> None:
        self._date_format = date_format if date_format else '%y%m%d_%H%M%S'
        if not filename_pattern:
            filename_pattern = '${SCRIPT}_${AUDIT_NAME}_${DATE}'
        self._filename_template = Template(filename_pattern)

    def create_filename(self,
                        execution_id,
                        all_audit_names,
                        script_name,
                        start_time,
                        custom_logging_config: Optional[LoggingConfig],
                        parameter_configs,
                        parameter_value_wrappers):

        audit_name = get_audit_name(all_audit_names)
        audit_name = file_utils.to_filename(audit_name)

        date_string = ms_to_datetime(start_time).strftime(self._resolve_date_format(custom_logging_config))

        username = audit_utils.get_audit_username(all_audit_names)

        mapping = {
            'ID': execution_id,
            'USERNAME': username,
            'HOSTNAME': get_first_existing(all_audit_names, audit_utils.PROXIED_HOSTNAME, audit_utils.HOSTNAME,
                                           default='unknown-host'),
            'IP': get_first_existing(all_audit_names, audit_utils.PROXIED_IP, audit_utils.IP),
            'DATE': date_string,
            'AUDIT_NAME': audit_name,
            'SCRIPT': script_name
        }

        filename = self._resolve_filename_template(custom_logging_config).safe_substitute(mapping)
        filename = model_helper.fill_parameter_values(parameter_configs, filename, parameter_value_wrappers)
        if not filename.lower().endswith('.log'):
            filename += '.log'

        filename = filename.replace(" ", "_").replace("/", "_")

        return filename

    def _resolve_date_format(self, custom_logging_config: Optional[LoggingConfig]):
        if custom_logging_config and custom_logging_config.date_format:
            return custom_logging_config.date_format
        return self._date_format

    def _resolve_filename_template(self, custom_logging_config: Optional[LoggingConfig]):
        if custom_logging_config and custom_logging_config.filename_pattern:
            return Template(custom_logging_config.filename_pattern)
        return self._filename_template


class ExecutionLoggingController:
    def __init__(self, execution_service: ExecutionService, execution_logging_service):
        self._execution_logging_service = execution_logging_service
        self._execution_service = execution_service

    def start(self):
        execution_service = self._execution_service
        logging_service = self._execution_logging_service

        def started(execution_id, user):
            script_config = execution_service.get_config(execution_id, user)
            audit_name = user.get_audit_name()
            owner = user.user_id
            all_audit_names = user.audit_names
            output_stream = execution_service.get_anonymized_output_stream(execution_id)
            audit_command = execution_service.get_audit_command(execution_id)
            parameter_value_wrappers = script_config.parameter_values

            logging_service.start_logging(
                execution_id,
                audit_name,
                owner,
                audit_command,
                output_stream,
                all_audit_names,
                script_config,
                parameter_value_wrappers)

        def finished(execution_id, user):
            exit_code = execution_service.get_exit_code(execution_id)
            logging_service.write_post_execution_info(execution_id, exit_code)

        self._execution_service.add_start_listener(started)
        self._execution_service.add_finish_listener(finished)


def _to_summary(entry: HistoryEntry) -> HistoryEntrySummary:
    return HistoryEntrySummary(
        id=entry.id,
        user_name=entry.user_name,
        user_id=entry.user_id,
        start_time=entry.start_time,
        script_name=entry.script_name,
        exit_code=entry.exit_code)


def _matches_search(summary: HistoryEntrySummary, search_text):
    return (search_text in (summary.script_name or '').lower()
            or search_text in (summary.user_name or '').lower())


def _candidate_key(candidate):
    return candidate[0]


def _is_after_cursor(sort_key, cursor_key, descending):
    return sort_key < cursor_key if descending else sort_key > cursor_key


def _id_sort_key(id):
    """Ids are generated as incrementing numbers, but the folder may contain hand-made log files."""
    try:
        return 1, int(id), ''
    except (TypeError, ValueError):
        return 0, 0, str(id)


def _text_sort_key(value):
    return (1, value.lower()) if value is not None else (0, '')


def _datetime_sort_key(value):
    return (1, value) if value is not None else (0, _MIN_DATETIME)


def _sort_key(summary: HistoryEntrySummary, sort):
    id_key = _id_sort_key(summary.id)

    if sort == SORT_ID:
        primary = id_key
    elif sort == SORT_USER:
        primary = _text_sort_key(summary.user_name)
    elif sort == SORT_SCRIPT:
        primary = _text_sort_key(summary.script_name)
    else:
        primary = _datetime_sort_key(summary.start_time)

    return primary, id_key


def _cursor_value(summary: HistoryEntrySummary, sort):
    if sort == SORT_ID:
        return summary.id
    if sort == SORT_USER:
        return summary.user_name
    if sort == SORT_SCRIPT:
        return summary.script_name
    return to_millis(summary.start_time) if summary.start_time is not None else None


def _encode_cursor(summary: HistoryEntrySummary, sort, order):
    payload = json.dumps({'s': sort, 'o': order, 'i': summary.id, 'v': _cursor_value(summary, sort)})
    return base64.urlsafe_b64encode(payload.encode(ENCODING)).decode('ascii').rstrip('=')


def _decode_cursor(cursor, sort, order):
    try:
        padded = cursor + '=' * (-len(cursor) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode('ascii')).decode(ENCODING))
    except (ValueError, binascii.Error, UnicodeDecodeError):
        raise InvalidCursorException('Malformed cursor')

    if not isinstance(payload, dict):
        raise InvalidCursorException('Malformed cursor')

    if payload.get('s') != sort or payload.get('o') != order:
        raise InvalidCursorException('Cursor was created for a different sorting')

    id = payload.get('i')
    if id is None:
        raise InvalidCursorException('Malformed cursor')

    value = payload.get('v')
    id_key = _id_sort_key(id)

    try:
        if sort == SORT_ID:
            primary = id_key
        elif sort in (SORT_USER, SORT_SCRIPT):
            primary = _text_sort_key(value)
        else:
            primary = _datetime_sort_key(ms_to_datetime(value) if value is not None else None)
    except (AttributeError, TypeError, ValueError, OverflowError, OSError):
        raise InvalidCursorException('Malformed cursor')

    return primary, id_key


def _rstrip_once(text, char):
    if text.endswith(char):
        text = text[:-1]

    return text


def _lstrip_any_linesep(text):
    if text.startswith('\r\n'):
        return text[2:]

    if text.startswith(os.linesep):
        return text[len(os.linesep):]

    return text

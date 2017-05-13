#!/usr/bin/env python2

"""A minimal webserver to serve Twistor account configuration.

 Each extension connects to this server on localhost to obtain a list
 of valid certificates, and a configuration bundle.
"""
import logging
import logging.handlers
import datetime
import os, os.path
import urllib
import csv
import tempfile
import json
import sys
import time
from functools import wraps

import bottle as B

log = logging.getLogger(__name__)

def init_log(logger, levelname):
    """initialize logger to syslog"""
    _id = "creds" + "[%(process)d]"
    LOG_ATTR = {
        'debug': (logging.DEBUG,
                  _id + ' %(levelname)-5s %(name)s L%(lineno)-4d %(message)s'),
        'info': (logging.INFO,
                 _id + ' %(levelname)-5s %(message)s'),
        'warning': (logging.WARNING,
                    _id + ' %(levelname)-5s %(message)s'),
        'error': (logging.ERROR,
                  _id + ' %(levelname)-5s %(message)s'),
        'critical': (logging.CRITICAL,
                     _id + ' %(levelname)-5s %(message)s')}
    loglevel, logformat = LOG_ATTR[levelname]

    logger.setLevel(loglevel)
    # Clearing previous logs
    logger.handlers = []

    if os.name not in ['posix', 'mac']:
        raise Exception("unsupported platform")

    logsock = None
    for cand in ('/dev/log', '/var/run/syslog'):
        if os.path.exists(cand):
            logsock = cand

    # Setting formaters and adding handlers.
    formatter = logging.Formatter(logformat)
    handlers = []
    handler = logging.handlers.SysLogHandler(address=logsock)
    handlers.append(handler)

    if getattr(sys.stderr, "isatty", False):
        sh = logging.StreamHandler(sys.stderr)
        handlers.append(sh)

    for hnd in handlers:
        hnd.setFormatter(formatter)
        hnd.setLevel(loglevel)
        logger.addHandler(hnd)

    logger.addHandler(handler)

def mkdirp(dirname):
    """ same as mkdir -p """
    try:
        os.makedirs(dirname)
    except OSError, ose:
        if ose.errno == 17:
            pass
        else:
            raise

def EnableCORS(allow_methods, allow_headers=None, allow_creds=False,
               expose_headers=None, max_age=600):
    if allow_headers is None:
        allow_headers = ['Origin', 'Accept', 'Content-Type', 'Content-Length', 'Authorization']
    if expose_headers is None:
        expose_headers = ['Content-Length']

    def set_preflight_response_headers(for_origin):
        'OPTIONS response headers'
        B.response.headers['Access-Control-Allow-Origin'] = for_origin
        B.response.headers['Access-Control-Allow-Methods'] = ", ".join(allow_methods)
        if allow_headers:
            B.response.headers['Access-Control-Allow-Headers'] = allow_headers
        if allow_creds:
            B.response.headers['Access-Control-Allow-Credentials'] = "true"
        B.response.headers['Access-Control-Max-Age'] = str(max_age)

        # The response varies based on the source origin. Help cache appropriately.
        B.response.headers['Vary'] = "Origin"

    def set_response_headers(for_origin):
        'extra response headers on non-OPTIONS methods'
        B.response.headers['Access-Control-Allow-Origin'] = for_origin
        if expose_headers:
            B.response.headers['Access-Control-Expose-Headers'] = expose_headers
        if allow_creds:
            B.response.headers['Access-Control-Allow-Credentials'] = "true"
        # The response varies based on the source origin. Help cache appropriately.
        B.response.headers['Vary'] = "Origin"

    def _cors_decorator(fn):
        @wraps(fn)
        def _cors_wrapper(*args, **kwargs):
            request_origin = B.request.headers.get('Origin', None)

            if B.request.method == "OPTIONS":
                if request_origin is None:
                    raise B.HTTPError(403, "No Origin specified on OPTIONS request")
                set_preflight_response_headers(request_origin)
            else:
                if request_origin is None:
                    return fn(*args, **kwargs)

                set_response_headers(request_origin)
                return fn(*args, **kwargs)
        return _cors_wrapper
    return _cors_decorator


class JsonDB(object):
    """
    file database

    uuid, instance_id, ip, cert
    """

    def __init__(self, fname):
        self.fname = fname
        self.db = []
        self._load()

    def _load(self):
        data = []
        try:
            with open(self.fname) as dbfile:
                for line in dbfile:
                    line = line.strip()
                    if not line or line.startswith("#") or line.startswith("//"):
                        data.append((line,))
                        continue
                    data.append(json.loads(line))
        except IOError, ioe:
            if ioe.errno != 2:
                raise

        self.db = data

    def save(self):
        with tempfile.NamedTemporaryFile(delete=False, dir=os.path.dirname(self.fname)) as tmpfile:
            for entry in self.db:
                if isinstance(entry, tuple):
                    tmpfile.write(entry[0] + "\n")
                else:
                    tmpfile.write(json.dumps(entry) + "\n")
        os.rename(tmpfile.name, self.fname)

    def find(self, filter_fn):
        """find all entries matching filter_fn. call save() if you change the content """
        return [entry for entry in self.db if (isinstance(entry, dict) and filter_fn(entry))]

    def insert(self, entry):
        self.db.append(entry)

class CredsDB(object):
    """
    key value store file

    instance_id,twitter_id,twitter_pass,gh_id,gh_pass,keypair_export,cert_export
    """
    def __init__(self, fname):
        self.fname = fname
        self.db = None
        self.fieldnames = None
        self._load()

    def _mkdir(self):
        mkdirp(os.path.dirname(self.fname))

    def _load(self):
        data = {}
        with open(self.fname) as csvfile:
            reader = csv.DictReader(csvfile, restval='extra')
            for row in reader:
                data[row['account_id']] = row
            self.fieldnames = reader.fieldnames
            self.db = data

    def _save(self):
        if not self.db:
            return

        with tempfile.NamedTemporaryFile(delete=False) as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=self.fieldnames)
            writer.writeheader()
            for key in sorted(self.db.keys()):
                writer.writerow(self.db[key])
        os.rename(csvfile.name, self.fname + ".save")

    def get(self, key, default=None):
        """get the csv row"""
        return self.db.get(key, default)

class CredsApp(object):

    def __init__(self, opts):
        super(CredsApp, self).__init__()
        self.app = B.Bottle()
        self.opts = opts

        self.creds_db = CredsDB(os.path.join(opts.configdir, "creds.csv"))
        self.clients_db = JsonDB(os.path.join(opts.configdir, "clients.json"))
        self.logs_dir = opts.logsdir

        self.app.route('/', method=['GET', 'OPTIONS'])(self.root)
        self.app.route('/logs/<uuid>', method=['OPTIONS', 'POST'])(self.save_logs)
        self.app.route('/instance/<uuid>', method=['OPTIONS', 'POST'])(self.new_instance)
        self.app.route('/test-rate/<per_second>', method=['OPTIONS', 'GET'])(self.test_rate)

    def _find_free_account(self):
        usable = [row for row in self.creds_db.db.values() if row['is_usable'] == 'y']
        free = [row for row in usable if not self.clients_db.find(lambda cli: cli['account_id'] == row['account_id'])]
        if not free:
            return None
        else:
            return free[0]

    @staticmethod
    def _bork(msg, status=500):
        raise B.HTTPResponse(status=status, body=json.dumps({'error': True, 'message': msg}))

    @staticmethod
    def root():
        """ default index. noop """
        return {}

    @EnableCORS(['POST'])
    def new_instance(self, uuid):
        """ an installed client wishes to acquire a new name """
        assigned = self.clients_db.find(lambda x: x['uuid'] == uuid)
        if assigned:
            return assigned[0]
        else:
            free_acct = self._find_free_account()
            if not free_acct:
                self._bork('no more accounts', status=503)
            new_instance = free_acct.copy() # shallow
            new_instance['uuid'] = uuid
            new_instance['ip'] = B.request.environ.get('REMOTE_ADDR')
            self.clients_db.insert(new_instance)
            self.clients_db.save()
            return new_instance

    @EnableCORS(['GET'])
    def test_rate(self, per_second):
        """spits out tweets at per_second rate"""
        send_interval = 1 / float(per_second)

        n = 1

        while True:
            # TODO This should yield a JSON-formatted tweet rather than just an integer.
            yield '%i\n' % n
            n += 1
            time.sleep(send_interval)

    @EnableCORS(['GET'])
    def config(self, name):
        """ get the config bundle """
        data = self.creds_db.get(name)
        if not data:
            self._bork('no such instance', status=404)

    @EnableCORS(['POST'])
    def save_logs(self, uuid):
        """ clients can submit their console logs to the server to persist them """
        mkdirp(self.logs_dir)
        logfile = os.path.join(self.logs_dir, urllib.quote(uuid, safe='') + ".log")
        with open(logfile, "a") as logfile:
            data = B.request.body.read()
            logfile.write(data + "\n")
        return {}

class AccessLogMiddleware(object):
    """monkey patch bottle so that it logs each request"""
    def __init__(self, app):
        self.app = app

    @staticmethod
    def log_after_request():
        """log request parameters to log"""
        try:
            length = B.response.content_length
        except Exception:
            try:
                length = len(B.response.body)
            except Exception:
                length = '???'
        log.info('{ip} - - [{time}] "{method} {uri} {protocol}" {status} {length}'.format(
            ip=B.request.environ.get('REMOTE_ADDR'),
            time=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            method=B.request.environ.get('REQUEST_METHOD'),
            uri=B.request.fullpath + (("?" + B.request.query_string) if B.request.query_string else ""),
            protocol=B.request.environ.get('SERVER_PROTOCOL'),
            status=B.response.status_code,
            length=length,
        ))

    def __call__(self, *args):
        ret_val = self.app(*args)
        self.log_after_request()
        return ret_val

class QuietWSGIRefServer(B.WSGIRefServer):
    quiet = True

def main():
    import argparse
    parser = argparse.ArgumentParser(description='credentials server')

    parser.add_argument('--configdir', metavar="D",
                        help='configuration directory',
                        default="./config")
    parser.add_argument('--logsdir', metavar="D",
                        help='directory to store client logs',
                        default="./logs")
    parser.add_argument('--port', metavar='P', type=int,
                        help='port number',
                        default=60000)
    parser.add_argument('--host', metavar="H",
                        help="hostname",
                        default="localhost")

    args = parser.parse_args()
    init_log(log, 'debug')
    creds = CredsApp(args)
    logged_app = AccessLogMiddleware(creds.app)
    log.info("Running server on %s, port %s", args.host, args.port)
    B.run(host=args.host, port=args.port, app=logged_app, server=QuietWSGIRefServer)
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())

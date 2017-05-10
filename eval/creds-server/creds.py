#!/usr/bin/env python2

"""A minimal webserver to serve Twistor account configuration.

 Each extension connects to this server on localhost to obtain a list
 of valid certificates, and a configuration bundle.
"""
import logging
import logging.handlers
import datetime
import os.path
import urllib
import csv
import tempfile
from functools import wraps

import bottle as B

log = logging.getLogger(__name__)

def init_log(logger, levelname):
    """initialize logger to syslog"""
    _id = "[creds]"
    LOG_ATTR = {
        'debug': (logging.DEBUG,
                  _id + ' %(levelname)-9s %(name)-15s %(threadName)-14s L%(lineno)-4d %(message)s'),
        'info': (logging.INFO,
                 _id + ' %(levelname)-9s %(message)s'),
        'warning': (logging.WARNING,
                    _id + ' %(levelname)-9s %(message)s'),
        'error': (logging.ERROR,
                  _id + ' %(levelname)-9s %(message)s'),
        'critical': (logging.CRITICAL,
                     _id + ' %(levelname)-9s %(message)s')}
    loglevel, logformat = LOG_ATTR[levelname]

    logger.setLevel(loglevel)
    # Clearing previous logs
    logger.handlers = []

    # Setting formaters and adding handlers.
    formatter = logging.Formatter(logformat)
    handlers = []
    handler = logging.handlers.SysLogHandler(address='/dev/log')
    handlers.append(handler)
    for hnd in handlers:
        hnd.setFormatter(formatter)
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
                print row
                data[row['instance_id']] = row
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
        self.logs_dir = opts.logsdir

        self.app.route('/', method=['GET', 'OPTIONS'])(self.root)
        self.app.route('/config/<name>', method=['OPTIONS', 'GET'])(self.config)
        self.app.route('/logs/<name>', method=['OPTIONS', 'POST'])(self.save_logs)

    @staticmethod
    def _bork(msg, status=500):
        raise B.HTTPResponse(status=status, body={'error': True, 'message': msg})

    @staticmethod
    def root():
        """ default index. noop """
        return {"name": "default"}

    @EnableCORS(['GET'])
    def config(self, name):
        """ get the config bundle """
        data = self.creds_db.get(name)
        if not data:
            self._bork('no such instance', status=404)

    @EnableCORS(['POST'])
    def save_logs(self, name):
        """ clients can submit their console logs to the server to persist them """
        mkdirp(self.logs_dir)
        logfile = os.path.join(self.logs_dir, urllib.quote(name, safe='') + ".log")
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
    B.run(host=args.host, port=args.port, app=logged_app)
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())

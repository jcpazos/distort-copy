#!/usr/bin/env python2

"""A minimal webserver to serve Twistor account configuration.

 Each extension connects to this server on localhost to obtain a list
 of valid certificates, and a configuration bundle.
"""
import logging
import logging.handlers
import datetime

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

class CredsApp(object):

    def __init__(self, opts):
        super(CredsApp, self).__init__()
        self.app = B.Bottle()
        self.opts = opts

        self.app.route('/', method=['GET', 'OPTIONS'])(self.root)
        self.app.route('/config/<name>', method=['GET'])(self.config)

    @staticmethod
    def root():
        """ default index. noop """
        return {"name": "default"}

    def config(self, name):
        """ get the config bundle """
        return B.static_file(name + ".json", root=self.opts.staticdir)

class AccessLogMiddleware(object):
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

    parser.add_argument('--staticdir', metavar="D",
                        help='static file directory',
                        default=".")
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

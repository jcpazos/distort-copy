#!/usr/bin/env python2

"""
  Chrome extension update server

   http://<host>/updates   -- get update xml

   http://<host>/dl/<filename.crx> -- download file
"""

import bottle as B
import cgi
import glob
import os.path
import crxinfo

class UpdateApp(object):
    """Serves CRX files and XML manifests of extension versions"""

    def __init__(self, opts):
        super(UpdateApp, self).__init__()
        self.app = B.Bottle()
        self.opts = opts
        self.app.route('/updates', method=['GET'])(self.update_xml)
        self.app.route('/all', method=['GET'])(self.all)
        self.app.route(r'/dl/<filename:re:.*\.crx>', method=['GET'])(self.dl_ext)

    def _webpath(self, abspath):
        webpath = abspath
        if webpath.startswith(self.opts.dldir):
            webpath = webpath[len(self.opts.dldir):]
        while webpath.startswith("/"):
            webpath = webpath[1:]
        return webpath

    def _find_crx_files(self):
        search_glob = os.path.join(self.opts.dldir, "*.crx")
        return glob.glob(search_glob)

    def dl_ext(self, filename):
        """downloads CRX files"""
        return B.static_file(filename, root=self.opts.dldir, mimetype="application/x-chrome-extension")

    def all(self):
        hostname = self.opts.hostname
        scheme = "http"
        port = self.opts.port
        B.response.headers['Content-Type'] = "application/xml"
        yield """<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>"""
        for crx in self._find_crx_files():
            info = crxinfo.examine(crx)
            if not info:
                continue
            yield """
<app appid='%(appid)s'>
  <updatecheck codebase='%(scheme)s://%(host)s:%(port)d/dl/%(filepath)s' version='2.0' />
</app>""" % {"appid": info['id'],
             "scheme":scheme,
             "host":hostname,
             "port": port,
             "filepath": self._webpath(crx)}
        yield """
</gupdate>"""

    def update_xml(self):
        """
        https://developer.chrome.com/extensions/autoupdate

        The format of the request parameters is:

        ?x=<extension_data>

        Where <extension_data> is a URL-encoded string of the format:

        id=<id>&v=<version>

        ex:
        /updates?os=linux&arch=x64&nacl_arch=x86-64&prod=chromecrx&prodchannel=&prodversion=58.0.3029.81&lang=en-GB&x=id%3Dohmpdiobkemenjbaamoeeenbniglebli%26v%3D0.0.0.0%26installsource%3Dnotfromwebstore%26uc
        """
        requested = {}
        for x in B.request.query.getall("x"):
            kvs = cgi.parse_qs(x)
            if 'id' in kvs:
                requested[kvs['id']] = kvs.get('v', '0.0.0.0')

        hostname = self.opts.hostname
        scheme = "http"
        port = self.opts.port

        B.response.headers['Content-Type'] = "application/xml"
        yield """<?xml version='1.0' encoding='UTF-8'?>
  <gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>"""
        for crx in self._find_crx_files():
            info = crxinfo.examine(crx)
            if not info:
                continue
            if info['id'] in requested:
                yield """
<app appid='%(appid)s'>
  <updatecheck codebase='%(scheme)s://%(host)s:%(port)d/dl/%(filepath)s' version='2.0' />
</app>""" % {"appid": info['id'],
             "scheme":scheme,
             "host":hostname,
             "port": port,
             "filepath": self._webpath(crx)}

def main():
    """parse args and start server"""
    import argparse
    import socket

    parser = argparse.ArgumentParser(description='omaha-style update server')

    parser.add_argument('--dldir', metavar="D",
                        help='directory where extensions are stored',
                        default=".")
    parser.add_argument('--port', metavar='P', type=int,
                        help='port number',
                        default=65000)
    parser.add_argument('--bindhost', metavar="H",
                        help="hostname to bind listening socket to",
                        default="0.0.0.0")
    parser.add_argument('--hostname', metavar="H",
                        help="hostname listed in the xml files served. external name of the host.",
                        default=socket.getfqdn())

    args = parser.parse_args()
    srv = UpdateApp(args)
    B.run(host=args.bindhost, port=args.port, app=srv.app)
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())

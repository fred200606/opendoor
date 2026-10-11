import http from 'node:http';

// Node 19+ keeps HTTP sockets alive by default, so nock's mock sockets are reused between tests.
// On Linux (CI) an error reply (`replyWithError`) on a reused mock socket ended as an
// "Unhandled error" event; one fresh socket per request avoids it.
http.globalAgent = new http.Agent({ keepAlive: false });

import nock from 'nock';

// Every test file gets its own copy of nock, and each copy patches Node's shared `http` module.
// When Jest runs several files in one worker (CI runners have few cores), the patches of earlier
// files stay active and wrap the next file's requests: error replies then surface as
// "Unhandled error" events. Remove this file's interceptor when the file is done.
afterAll(() => nock.restore());

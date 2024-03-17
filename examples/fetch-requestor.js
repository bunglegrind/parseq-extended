/*jslint node, browser, unordered */
/*property
    abort, assign, body, cookie, create, evidence, factory, factory_maker,
    freeze, headers, method, parallel_object, parse, promise_requestorize,
    requestBody, requestor_name, requestorize, sequence, signal, status,
    stringify, text, uri
*/
import pq from "./parseq-extended.js";

function fetchRequestor(
    callback,
    {uri, cookie, method, requestBody, headers, requestor_name}
) {
    const options = Object.create(null);
    options.method = method ?? "get";
    options.headers = headers || {};
    requestor_name = requestor_name || `fetching ${method}/${uri}`;
    if (requestBody) {
        options.body = JSON.stringify(requestBody);
        options.headers["content-type"] = "application/json";
    }
    if (cookie) {
        options.headers.cookie = cookie;
    }
    const controller = new AbortController();
    options.signal = controller.signal;

    return pq.sequence([
        pq.promise_requestorize(
            () => fetch(uri, options),
            requestor_name,
            () => controller.abort()
        ),
        pq.requestorize(function (value) {
            if (value.status > 499) {
                const serr = new Error(
                    `server error in ${requestor_name}`
                    + `Body: ${JSON.stringify(requestBody)}`
                );
                serr.evidence = value;
                throw serr;
            }
            if (value.status > 299) {
                const cerr = new Error(
                    `client error in ${requestor_name}`
                    + `Body: ${JSON.stringify(requestBody)}`
                );
                cerr.evidence = value;
                throw cerr;
            }

            return value;
        }, requestor_name),
        pq.parallel_object({
            headers: pq.requestorize((r) => r.headers),
            body: pq.sequence([
                function (cb, p) {
                    return pq.promise_requestorize(
                        () => p.text(),
                        `${requestor_name} - convert to text`
                    )(cb);
                },
                pq.requestorize(
                    (v) => JSON.parse(v),
                    `${requestor_name} - convert to json`
                )
            ])
        })
    ])(callback);
}

export default Object.freeze({factory: pq.factory_maker(fetchRequestor)});

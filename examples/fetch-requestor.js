/*jslint node, browser, unordered */
/*property
    abort, assign, body, cookie, create, evidence, factory, factory_maker,
    freeze, headers, method, parallel_object, parse, promise_requestorize,
    requestBody, requestorize, sequence, signal, status, stringify, text, uri
*/
import pq from "./parseq-extended.js";

function fetchJSONRequestor(callback, {uri, cookie, method, requestBody}) {
    const options = Object.create(null);
    if (requestBody) {
        options.body = JSON.stringify(requestBody);
        options.headers = {
            "Content-Type": "application/json"
        };
    }
    if (cookie) {
        options.headers = Object.assign(
            Object.create(null),
            options.headers,
            {cookie}
        );
    }
    const controller = new AbortController();
    options.signal = controller.signal;

    return pq.sequence([
        pq.promise_requestorize(
            () => fetch(uri, options),
            `fetching ${method}/${uri}`,
            () => controller.abort()
        ),
        pq.requestorize(function (value) {
            if (value.status > 499) {
                const serr = new Error(
                    `server error in method/uri ${method}/${uri}`
                    + `Body: ${JSON.stringify(requestBody)}`
                );
                serr.evidence = value;
                throw serr;
            }
            if (value.status > 299) {
                const cerr = new Error(
                    `client error in method/uri ${method}/${uri}`
                    + `Body: ${JSON.stringify(requestBody)}`
                );
                cerr.evidence = value;
                throw cerr;
            }

            return value;
        }, "fetch"),
        pq.parallel_object({
            headers: pq.requestorize((r) => r.headers),
            body: pq.sequence([
                function (cb, p) {
                    return pq.promise_requestorize(
                        () => p.text(),
                        `converting to Text ${method}/${uri}`
                    )(cb);
                },
                pq.requestorize(
                    (v) => JSON.parse(v),
                    "conversion to JSON"
                )
            ])
        })
    ])(callback);
}
const fetchJSONFactory = pq.factory_maker(fetchJSONRequestor);

export default Object.freeze({factory: fetchJSONFactory});


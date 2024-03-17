/*jslint
    node, unordered
 */
/*property
    Accept, Cookie, Pragma, assign, body, byteLength, concat,cookie,
    createBrotliDecompress, createGunzip, createInflate, destroy, end, error,
    evidence, factory, factory_maker, freeze, headers, host, hostname, id,
    image, location, make_reason, method, on, path, pathname, pipe, protocol,
    push, request, search, setHeader, split, startsWith, status, statusCode,
    timeout, toString, toUpperCase, type, url, write
*/
import http from "http";
import https from "https";
import zlib from "zlib";
import pq from "./parseq-extended.js";


const default_headers = {
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        + "image/avif,image/webp,*/*;q=0.8"
    ),
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:94.0) "
        + "Gecko/20100101 Firefox/94.0"//firefox
    ),
    "Pragma": "no-cache",
    "Cookie": "qtheme_cookies_accept=1",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "it-IT,it;q=0.8,en-US;q=0.5,en;q=0.3",
    "Cache-Control": "no-cache",
    "Upgrade-Insecure-Requests": "1"
};

function decompress(response) {
    if (response.headers["content-encoding"] === "gzip") {
        const gunzip = zlib.createGunzip();
        response.pipe(gunzip);
        return gunzip;
    }
    if (response.headers["content-encoding"] === "deflate") {
        const inflate = zlib.createInflate();
        response.pipe(inflate);
        return inflate;
    }
    if (response.headers["content-encoding"] === "br") {
        const br = zlib.createBrotliDecompress();
        response.pipe(br);
        return br;
    }

    return response;
}

function select_protocol(prot) {
    return (
        prot === "https:"
        ? https
        : http
    );
}

function requestor(cb, {url, method, body, cookie, headers}) {
    body = body || "";
    headers = headers || {};
    method = method || "get";
    if (cookie) {
        headers.cookie = cookie;
    }
    let parsed_url;

    function make_url(location) {
        return (
            location.startsWith("http")
            ? location
            : parsed_url.protocol + "//" + parsed_url.hostname + location
        );
    }

    try {
        parsed_url = new URL(url);
    } catch (e) {
        return cb(
            undefined,
            pq.make_reason(
                "http request",
                `invalid URL provided: ${url}`,
                e
            )
        );
    }
    const options = {
        path: parsed_url.pathname + (parsed_url.search ?? ""),
        host: parsed_url.hostname,
        method: method.toUpperCase(),
        headers: Object.assign({}, default_headers, headers),
        timeout: 5 * 1000
    };
    const req = select_protocol(parsed_url.protocol).request(
        url,
        options,
        function (res) {
            let response = [];
            const content_type = res.headers["content-type"];
            function attach_listeners(res) {
                res.on("data", function (chunk) {
                    return response.push(chunk);
                });
                res.on("end", function () {
                    clearTimeout(id);
                    const buffered_response = Buffer.concat(response);
                    if (content_type.startsWith("image")) {
                        return cb({
                            image: buffered_response,
                            type: content_type.split("/")[1]
                        });
                    }
                    return cb(buffered_response.toString());
                });
                res.on("aborted", function (err) {
                    clearTimeout(id);
                    return cb(
                        undefined,
                        pq.make_reason(
                            "http request",
                            `Aborted ${url}`,
                            err
                        )
                    );
                });
                res.on("error", function (err) {
                    clearTimeout(id);
                    return cb(
                        undefined,
                        pq.make_reason(
                            "http request",
                            `Error ${url}`,
                            err
                        )
                    );
                });
            }
            if (res.statusCode >= 400) {
                clearTimeout(id);
                return cb(
                    undefined,
                    pq.make_reason(
                        "http request",
                        `Client/Server Error ${url}`,
                        {status: res.statusCode, error: res}
                    )
                );
            }
            if (res.statusCode >= 300) {
                clearTimeout(id);
                const location = res?.headers?.location;
                if (!location) {
                    return cb(
                        undefined,
                        pq.make_reason(
                            "http request",
                            `Wrong ${url} redirection aborted`,
                            {status: res.statusCode}
                        )
                    );
                }
                return requestor(cb, {
                    url: make_url(location),
                    method: "GET",
                    headers
                });
            }
            return attach_listeners(decompress(res));
        }
    );

    req.on("timeout", function (err) {
        clearTimeout(id);
        req.destroy();
        return cb(undefined, "Timeout: " + err + " url: " + url);
    });
    req.on("error", function (err) {
        clearTimeout(id);
        return cb(
            undefined,
            "Error: " + err + " url: " + url
        );
    });
    if (body) {
        req.setHeader("Content-Length", Buffer.byteLength(body));
        req.setHeader("Content-Type", "application/x-www-form-urlencoded");
        req.write(body);
    }
    req.end();
    const id = setTimeout(function () {
        req.destroy();
        return cb(undefined, `Still retrieving url ${url}. Aborting`);
    }, 20 * 1000);

    return function cancel() {
        clearTimeout(id);
        return req.destroy();
    };
}

export default Object.freeze({factory: pq.factory_maker(requestor)});

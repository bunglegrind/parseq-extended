import parseq from "./parseq.js";

function do_nothing(cb, v) {
    return cb(v);
}

function constant(v) {
    return function requestor_constant(callback) {
        return callback(v);
    }
}

function when(condition, requestor) {
    return function (callback, value) {
        if (condition(value)) {
            return requestor(callback, value);
        }
        return do_nothing(callback, value); 
    }
}

function requestorize(unary) {
    return function requestor(callback, value) {
        try {
            return callback(unary(value));
        } catch (exception) {
            return callback(undefined, exception);
        }
    }
}

function wrap_reason(requestor) {
    return function (callback, value) {
        return requestor(function (value, reason) {
            return callback({value, reason});
        }, value);
    }
}

function apply_race(
    requestor_factory,
    time_limit,
    throttle
) {
    return function (callback, value) {
        try {
            return parseq.race(
                value.map(requestor_factory),
                time_limit,
                throttle
            )(callback);
        } catch (e) {
            return callback(undefined, e);
        }
    }
}

function apply_fallback(
    requestor_factory,
    time_limit
) {
    return function (callback, value) {
        try {
            return parseq.fallback(
                value.map(requestor_factory),
                time_limit
            )(callback);
        } catch (e) {
            return callback(undefined, e);
        }
    }
}

function apply_parallel(
    requestor_factory,
    optional_requestor_factory,
    time_limit,
    time_option,
    throttle
) {
    return function (callback, value) {
        try {
            return parseq.parallel(
                value.map(requestor_factory),
                (
                    typeof optional_requestor === "function"
                    ? value.map(optional_requesto_factoryr)
                    : []
                ),
                time_limit,
                time_option,
                throttle
            )(callback);
        } catch (e) {
            return callback(undefined, e);
        }
    }
}

function wrap_requestor(value, requestor) {
    return function (callback) {
        return requestor(callback, value);
    }
}

function apply_parallel_object(
    requestor_factory,
    optional_requestor_factory,
    time_limit,
    time_option,
    throttle
) {
    return function (callback, value) {
        try {
            const keys = Object.keys(value);

        } catch (e) {
            return callback(undefined, e);
        }
    }

export default Object.freeze({
    ...parseq,
    wrap_reason,
    wrap_requestor,
    requestorize,
    do_nothing,
    when,
    apply_race,
    apply_fallback,
    apply_parallel,
    apply_parallel_object
});

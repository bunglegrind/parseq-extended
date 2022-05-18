import parseq from "./parseq.js";

function do_nothing(cb, v) {
    return cb(v);
}

function when(condition, requestor) {
    return function (callback, value) {
        if (condition(value)) {
            return requestor(callback, value);
        }
        return callback(value); 
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

export default Object.freeze({
    ...parseq,
    wrap_reason,
    requestorize,
    do_nothing,
    when
});

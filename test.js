/*jslint
    node, unordered
*/
/*property
    a, apply_fallback, apply_parallel, apply_parallel_object, apply_race,
    assign, b, c, constant, create, deep_equal, do_nothing, evidence, fallback,
    isArray, keys, length, parallel, parallel_object, promise_requestorize,
    race, reason, requestorize, same, sequence, toString, value, when,
    wrap_reason, wrap_requestor
*/
import process from "node:process";
import {before, test} from "node:test";
import assert from "node:assert/strict";
import parseq_extended from "./parseq-extended.js";
import parseq from "./parseq.js";

function requestor_fail(callback) {
    setTimeout(callback, 0, undefined, "failed");
}

const a_little_promise = new Promise(function (resolve) {
    setTimeout(() => resolve("success"), 0);
});

function myError(msg) {
    const err = new Error(msg);
    err.myFlag = true;

    return err;
}

before(function () {
    const defaultExceptionListener = process.listeners("uncaughtException")[0];
    process.removeAllListeners("uncaughtException");
    process.on("uncaughtException", function (err) {
        if (!err.myFlag && !err?.evidence?.myFlag) {
            defaultExceptionListener(err);
        }
    });

    const defaultRejectionListener = process.listeners("unhandledRejection")[0];
    process.removeAllListeners("unhandledRejection");
    process.on("unhandledRejection", function (err) {
        if (!err.myFlag && !err?.evidence?.myFlag) {
            defaultRejectionListener(err);
        }
    });
});

function hasThrown(event, message, t, done) {
    const id = setTimeout(function () {
        done(new Error("Callback should throw"));
    }, 1000);
    const listener = function (err) {
        if (
            err?.evidence?.message === `${message}`
            || err?.message === `${message}`
        ) {
            process.removeListener(event, listener);
            clearTimeout(id);
            done();
        }
    };
    process.prependListener(event, listener);
}

test("parseq-extended should include parseq", function () {
    assert.equal(
        parseq_extended.sequence,
        parseq.sequence,
        "sequence should be in parseq extended"
    );
    assert.equal(
        parseq_extended.parallel,
        parseq.parallel,
        "parallel should be in parseq extended"
    );
    assert.equal(
        parseq_extended.fallback,
        parseq.fallback,
        "fallback should be in parseq extended"
    );
    assert.equal(
        parseq_extended.parallel_object,
        parseq.parallel_object,
        "parallel_object should be in parseq extended"
    );
    assert.equal(
        parseq_extended.race,
        parseq.race,
        "race should be in parseq extended"
    );
});

test("wrap_reason should encapsulate reasons", function (t, done) {
    parseq_extended.parallel(
        [parseq_extended.wrap_reason(requestor_fail)]
    )(function (value, ignore) {
        try {
            assert.equal(Array.isArray(value), true, "value is array");
            assert.equal(value.length, 1, "value is wun element array");
            assert.equal(typeof value[0], "object", "value element is an object");
            const keys = Object.keys(value[0]);
            assert.equal(keys.length, 2, "two keys in the return object");
            assert.deepEqual(
                keys,
                ["value", "reason"],
                "value and reason are the value keys"
            );
            assert.deepEqual(
                value[0],
                {value: undefined, reason: "failed"},
                "The returned object should be the wun expected"
            );
            done();

        } catch (e) {
           done(e);
        }
    });
});

test("constant must return a constant", function (t, done) {
    parseq_extended.constant(5)(function (value, ignore) {
        done(assert.equal(value, 5, "it should be five"));
    });
});

test("do nothing just passes a value", function (t, done) {
    parseq_extended.sequence([
        parseq_extended.constant(5),
        parseq_extended.do_nothing
    ])(function (value, ignore) {
        done(assert.equal(value, 5, "it should be five"));
    });
});

test(
    "Requestorize transforms an unary function into a requestor",
    function (t, done) {
        parseq_extended.sequence([
            parseq_extended.constant(5),
            parseq_extended.requestorize((x) => x + 1)
        ])(function (value, ignore) {
            done(assert.equal(value, 6, "it should be six"));
        });
    }
);

test("Map a requestor into an array", function (t, done) {
    parseq_extended.sequence([
        parseq_extended.constant([1, 2, 3]),
        parseq_extended.when(
            (v) => v.length === 3,
            parseq_extended.apply_parallel(
                parseq_extended.factory(
                    parseq_extended.requestorize((x) => x + 1)
                )
            )
        )
    ])(function (value, ignore) {
        done(assert.deepEqual(value, [2, 3, 4], "it should be [2, 3, 4]"));
    });
});

test("A factory called without parameters passes online value to the requestor", function (t, done) {
    parseq_extended.factory(
        parseq_extended.requestorize(({v}) => v + 1)
    )()(function (value, ignore) {
       done(assert.equal(value, 4));
    }, {v: 3});
});

test("Map a requestor which is expecting an array into an array", function (t, done) {
    parseq_extended.sequence([
        parseq_extended.constant([[1], [2], [3]]),
        parseq_extended.when(
            (v) => v.length === 3,
            parseq_extended.apply_parallel(
                parseq_extended.factory(
                    parseq_extended.requestorize(([x]) => x + 1)
                )
            )
        )
    ])(function (value, ignore) {
        done(assert.deepEqual(value, [2, 3, 4], "it should be [2, 3, 4]"));
    });
});

test("Map a requestor into an object", function (t, done) {
    parseq_extended.sequence([
        parseq_extended.constant({a: 1, b: 2, c: 3}),
        parseq_extended.when(
            (v) => Object.keys(v).length === 3,
            parseq_extended.apply_parallel_object(
                parseq_extended.factory(
                    parseq_extended.requestorize((x) => x + 1)
                )
            )
        )
    ])(function (value, ignore) {
        done(assert.deepEqual(
            value,
            Object.assign(Object.create(null), {a: 2, b: 3, c: 4}),
            "it should be {a: 2, b: 3, c: 4}"
        ));
    });
});

test("Map an array to a fallback", function (t, done) {
    parseq_extended.sequence([
        parseq_extended.constant([0, 1, 2]),
        parseq_extended.apply_fallback(
            parseq_extended.factory(
                parseq_extended.when((v) => v === 0, requestor_fail)
            )
        )
    ])(function (value, ignore) {
        done(assert.deepEqual(value, 1, "it should be 1"));
    });
});

test("Map timeouts to a race", function (t, done) {
    parseq_extended.sequence([
        parseq_extended.constant([5000, 500, 10000]),
        parseq_extended.apply_race(
            function (t) {
                return function (callback) {
                    const cancel = setTimeout(
                        () => callback(`success ${t}`),
                        t
                    );
                    return function () {
                        clearTimeout(cancel);
                    };
                };
            }
        )
    ])(function (value, ignore) {
        done(assert.equal(value, "success 500", "timeout 500 should win"));
    });
});

test("Map timeouts to a failing race", function (t, done) {
    parseq_extended.sequence([
        parseq_extended.constant([5000, 500, 10000]),
        parseq_extended.apply_race(
            function (t) {
                return function (callback) {
                    const cancel = setTimeout(
                        () => callback(`success ${t}`),
                        t
                    );
                    return function () {
                        clearTimeout(cancel);
                    };
                };
            },
            100
        )
    ])(function (value, reason) {
        try {
            assert.equal(value, undefined, "nobody should win");
            assert.equal(
                reason.toString(),
                "Error: parseq.race: Timeout.",
                "time_limit reached"
            );
            assert.equal(reason.evidence, 100, "time_limit");
            done();
        } catch (e) {
            done(e);
        }
    });
});

test("A promise becomes a requestor", function (t, done) {
    parseq_extended.promise_requestorize(a_little_promise)(
        function (value) {
            done(assert.equal(value, "success", "value should be success"));
        }
    );
});

test("a failing promise becomes a failing requestor", function (t, done) {
    const another_little_promise = new Promise(function (ignore, reject) {
        setTimeout(() => reject("failed"));
    });

    parseq_extended.promise_requestorize(another_little_promise)(
        function (value, reason) {
            try {
                assert.equal(value, undefined, "value should be undefined");
                assert.equal(
                    reason.message,
                    "parseq.promise_requestorize: Failed when executing promise",
                    "reason should be failed"
                );
                assert.equal(
                    reason.evidence,
                    "failed",
                    "reason should be failed"
                );
                done();
            } catch (e) {
                done(e);
            }
        }
    );
});

test("dynamic default imports are imported as requestors", function (t, done) {
    parseq_extended.dynamic_default_import("./dynamic_default_import.js")(
        function my_callback(value, reason) {
            try {
                assert.equal(reason, undefined, "reason should be undefined");
                assert.equal(value?.sample, true, "sample should be true");
                done();
            } catch (e) {
                done(e);
            }
        }
    );
});

test("dynamic failing default imports are detected", function (t, done) {
    parseq_extended.dynamic_default_import("./failing_import.js")(
        function my_callback(value, reason) {
            try {
                assert.equal(value, undefined, "value should be undefined");
                assert.equal(typeof reason, "object", "reason should be an object");
                assert.equal(
                    reason.message,
                    "parseq.promise_requestorize: Failed when importing ./failing_import.js",
                    "a reason should include a message"
                );
                assert.equal(
                    reason.evidence.message,
                    "non_existent_function is not defined",
                    "a reason should include a message"
                );
                done();
            } catch (e) {
                done(e);
            }
        }
    );
});

test("dynamic nondefault imports are imported as requestors", function (t, done) {
    parseq_extended.dynamic_import("./dynamic_import.js")(
        function my_callback(value, reason) {
            try {
                assert.equal(reason, undefined, "reason should be undefined");
                assert.equal(value?.sample, true, "sample should be true");
                done();
            } catch(e) {
                done(e);
            }
        }
    );
});

test(
    "delay requestor should execute unary function at least after x ms",
    function (t, done) {
        const delay1s = parseq_extended.delay(1000);
        const unary = (v) => v + 1;

        const start = Date.now();

        delay1s(unary)(function (value, reason) {
            try {
                assert.equal(value, 2);
                assert.ok(Date.now() - start >= 1000);
                done();
            } catch (e) {
                done(e);
            }
        }, 1);

    });

test("a factory should pass all the relevant parameters to the requestor", function (t, done) {
    parseq_extended.factory(parseq_extended.requestorize((v) => v))(
        function adapt_parameters(v) {
            return {...v, w: 2};
        })(function callback(value, reason) {
            done(assert.deepEqual(value, {v: 1, w: 2}));
        }, {v: 1});
});

test("default factory combiner should combine online value with offline values", function (t, done) {
    parseq_extended.factory(
        parseq_extended.requestorize((v) => v))({w: 2})(
            function callback(value, reason) {
                done(assert.deepEqual(value, {v: 1, w: 2}));
            }, {v: 1});
});

test(
    "Callback exceptions in a promise context must be uncaught - generic promise",
    function (t, done) {
        hasThrown(
            "unhandledRejection",
            "generic promise failed!",
            t,
            done
        );
        parseq_extended.sequence([
            parseq_extended.promise_requestorize(a_little_promise)
        ])(
            function (value, ignore) {
                throw myError("generic promise failed!");
            }
        );
    }
);

test(
    "Callback exceptions in a promise context must be uncaught - import",
    function (t, done) {
        hasThrown("unhandledRejection", "Callback failed in import", t , done);

        parseq_extended.sequence([
            parseq_extended.dynamic_import("./dynamic_import.js")
        ])(function my_callback(value, reason) {
            throw myError("Callback failed in import");
        });
    }
);

test(
    "Callback exceptions in a promise context must be uncaught - default import",
    function (t, done) {
        hasThrown("unhandledRejection", "Callback failed in default import", t , done);

        parseq_extended.sequence([
            parseq_extended.dynamic_import("./dynamic_default_import.js")
        ])(function my_callback(value, reason) {
            throw myError("Callback failed in default import");
        });
    }
);

test("Callback exceptions in a promise context must be uncaught - import without factory", function (t, done) {
    hasThrown("unhandledRejection", "Callback failed in import without factory", t , done);

    parseq_extended.dynamic_import("./dynamic_import.js")(
        function my_callback(value, reason) {
            throw myError("Callback failed in import without factory");
        }
    );
});

test("Callback exceptions in a promise context must be uncaught - default import without factory", function (t, done) {
    hasThrown("uncaughtException", "Callback failed in default import without factory", t , done);

    parseq_extended.dynamic_default_import("./dynamic_default_import.js")(
        function my_callback(value, reason) {
            throw myError("Callback failed in default import without factory");
        }
    );
});

test("Final callback exceptions must crash the program", function (t, done) {
    hasThrown("uncaughtException", "Booom!", t, done);

    let count = 0;
    parseq_extended.sequence([
        parseq_extended.sequence([
            parseq_extended.constant(5)
        ])
    ])(function (value, reason) {
        if (count) {
            return done(new Error("callback called twice"));
        }
        count += 1;
        throw myError("Booom!");
    });
});

test("parseq should provide a requestor to merge properties to a value", function (t, done) {
    parseq_extended.parallel_merge({
        prop_one: parseq_extended.constant(1),
        prop_two: parseq_extended.requestorize(({prop_zero}) => prop_zero + 5)
    })(function (value, ignore) {
        const expected = Object.assign(
            Object.create(null), {
                prop_one: 1,
                prop_two: 5,
                prop_zero: 0
            }
        );
        done(assert.deepEqual(value, expected));
    }, {prop_zero: 0});
});

/*jslint
    node, unordered, fart
*/
/*property
    a, apply_fallback, apply_parallel, apply_parallel_object, apply_race,
    assign, b, c, constant, create, deepEqual, delay, do_nothing,
    dynamic_default_import, dynamic_import, equal, evidence, f, factory_maker,
    factory_merge, fallback, isArray, keys, length, listeners, make_reason,
    message, myFlag, notEqual, now, ok, on, only, parallel, parallel_merge,
    parallel_object, persist, prependListener, promise_requestorize, prop_one,
    prop_two, prop_zero, push, q, race, reason, reduce, removeAllListeners,
    removeListener, requestorize, sample, sequence, signal, tap, time_limit,
    toString, v, value, w, when, wrap_reason, z
*/

import process from "node:process";
import {before, test} from "node:test";
import assert from "node:assert/strict";
import parseq_extended from "./parseq-extended.js";

function requestor_fail(callback) {
    setTimeout(callback, 0, undefined, "failed");
}

const a_little_promise_thunk = () => new Promise(function (resolve) {
    setTimeout(() => resolve("success"), 0);
});

function my_error(msg) {
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

function hasThrown(event, message, done) {
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

test("wrap_reason should encapsulate reasons", function (ignore, done) {
    parseq_extended.parallel(
        [parseq_extended.wrap_reason(requestor_fail)]
    )(function (value, reason) {
        assert.ok(value !== undefined, reason);
        assert.equal(Array.isArray(value), true, "value is array");
        assert.equal(value.length, 1, "value is wun element array");
        assert.equal(
            typeof value[0],
            "object",
            "value element is an object"
        );
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
    });
});

test("constant must return a constant", function (ignore, done) {
    parseq_extended.constant(5)(function (value, reason) {
        assert.ok(value !== undefined, reason);
        done(assert.equal(value, 5, "it should be five"));
    });
});

test("do nothing just passes a value", function (ignore, done) {
    parseq_extended.sequence([
        parseq_extended.constant(5),
        parseq_extended.do_nothing
    ])(function (value, reason) {
        assert.ok(value !== undefined, reason);
        done(assert.equal(value, 5, "it should be five"));
    });
});

test(
    "Requestorize transforms an unary function into a requestor",
    function (ignore, done) {
        parseq_extended.sequence([
            parseq_extended.constant(5),
            parseq_extended.requestorize((x) => x + 1)
        ])(function (value, reason) {
            assert.ok(value !== undefined, reason);
            done(assert.equal(value, 6, "it should be six"));
        });
    }
);

test(
    "Unary functions are not allowed to return undefined in requestorize",
    function (ignore, done) {
        parseq_extended.sequence([
            parseq_extended.constant(5),
            parseq_extended.requestorize(() => undefined)
        ])(function (value, reason) {
            assert.ok(value === undefined);
            done(assert.equal(
                reason.message,
                "parseq.requestorize: unary function returned undefined"
            ));
        });
    }
);

test("Map a requestor an array", function (ignore, done) {
    parseq_extended.sequence([
        parseq_extended.constant([1, 2, 3]),
        parseq_extended.when(
            (v) => v.length === 3,
            parseq_extended.apply_parallel(
                parseq_extended.factory_maker(
                    parseq_extended.requestorize((x) => x + 1)
                )
            )
        )
    ])(function (value, reason) {
        assert.ok(value !== undefined, reason);
        done(assert.deepEqual(value, [2, 3, 4], "it should be [2, 3, 4]"));
    });
});

test("Failing jobs are supposed to cancel tasks", function (ignore, done) {
    const called = [];
    function delay(failTime) {
        return function (ms) {
            return function (callback) {
                const id = setTimeout(function () {
                    if (ms === failTime) {
                        return callback(undefined, "Failed.");
                    }
                    return callback(true);
                }, ms);

                return function () {
                    clearTimeout(id);
                    called.push(ms);
                };
            };
        };
    }
    parseq_extended.sequence([
        parseq_extended.constant([100, 200, 3000]),
        parseq_extended.parallel([
            parseq_extended.apply_parallel(delay(5000)),
            parseq_extended.apply_parallel(delay(200))
        ])
    ])(function (value, ignore) {
        assert.ok(value === undefined);
        done(assert.deepEqual(called, [3000, 3000]));
    });
});

test(
    "A factory called without parameters passes online value to the requestor",
    function (ignore, done) {
        parseq_extended.factory_maker(
            parseq_extended.requestorize(({v}) => v + 1)
        )()(function (value, reason) {
            assert.ok(value !== undefined, reason);
            done(assert.equal(value, 4));
        }, {v: 3});
    }
);

test(
    "Map a requestor which is expecting an array into an array",
    function (ignore, done) {
        parseq_extended.sequence([
            parseq_extended.constant([[1], [2], [3]]),
            parseq_extended.when(
                (v) => v.length === 3,
                parseq_extended.apply_parallel(
                    parseq_extended.factory_maker(
                        parseq_extended.requestorize(([x]) => x + 1)
                    )
                )
            )
        ])(function (value, reason) {
            assert.ok(value !== undefined, reason);
            done(assert.deepEqual(value, [2, 3, 4], "it should be [2, 3, 4]"));
        });
    }
);

test("Map a requestor into an object", function (ignore, done) {
    parseq_extended.sequence([
        parseq_extended.constant({a: 1, b: 2, c: 3}),
        parseq_extended.when(
            (v) => Object.keys(v).length === 3,
            parseq_extended.apply_parallel_object(
                parseq_extended.factory_maker(
                    parseq_extended.requestorize((x) => x + 1)
                )
            )
        )
    ])(function (value, reason) {
        assert.ok(value !== undefined, reason);
        done(assert.deepEqual(
            value,
            Object.assign(Object.create(null), {a: 2, b: 3, c: 4}),
            "it should be {a: 2, b: 3, c: 4}"
        ));
    });
});

test("Map an array to a fallback", function (ignore, done) {
    parseq_extended.sequence([
        parseq_extended.constant([0, 1, 2]),
        parseq_extended.apply_fallback(
            parseq_extended.factory_maker(
                parseq_extended.when((v) => v === 0, requestor_fail)
            )
        )
    ])(function (value, reason) {
        assert.ok(value !== undefined, reason);
        done(assert.deepEqual(value, 1, "it should be 1"));
    });
});

test("Map timeouts to a race", function (ignore, done) {
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
    ])(function (value, reason) {
        assert.ok(value !== undefined, reason);
        done(assert.equal(value, "success 500", "timeout 500 should win"));
    });
});

test("Map timeouts to a failing race", function (ignore, done) {
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
            {time_limit: 100}
        )
    ])(function (value, reason) {
        assert.equal(value, undefined, "nobody should win");
        assert.equal(
            reason.toString(),
            "Error: parseq.race: Timeout.",
            "time_limit reached"
        );
        assert.equal(reason.evidence, 100, "time_limit");
        done();
    });
});

test("A promise thunk becomes a requestor", function (ignore, done) {
    parseq_extended.promise_requestorize(a_little_promise_thunk)(
        function (value, reason) {
            assert.ok(value !== undefined, reason);
            done(assert.equal(value, "success", "value should be success"));
        }
    );
});

test(
    "A promise_requestor can be cancelled if a cancel function is provided",
    function (ignore, done) {
        let id;
        let called = false;
        parseq_extended.parallel([
            parseq_extended.promise_requestorize(
                function () {
                    return new Promise(function (resolve) {
                        id = setTimeout(() => resolve("success"), 10000);
                    });
                },
                "promise",
                function () {
                    called = true;
                    clearTimeout(id);
                }
            ),
            parseq_extended.promise_requestorize(function () {
                return new Promise(function (ignore, reject) {
                    setTimeout(() => reject("failed"), 0);
                });
            })
        ])(function (value, ignore) {
            assert.ok(value === undefined);
            done(assert.ok(called === true));
        });
    }
);

test(
    "Not passing a promise thunk to promise_requestorize throws",
    function (ignore, done) {
        try {
            parseq_extended.promise_requestorize(
                (ignore) => a_little_promise_thunk
            )(
                function (value, reason) {
                    assert.ok(value !== undefined, reason);
                }
            );
        } catch (e) {
            assert.equal(
                e.message,
                "parseq.executing promise: Not a thunk when executing promise"
            );
        }

        parseq_extended.promise_requestorize(() => 4)(
            function (value, reason) {
                assert.ok(value === undefined, value);
                done(
                    assert.equal(
                        reason.evidence.message,
                        (
                            "parseq.executing promise: Not a promise when "
                            + "executing promise"
                        )
                    )
                );
            }
        );
    }
);


test(
    "a failing promise thunk becomes a failing requestor",
    function (ignore, done) {
        parseq_extended.promise_requestorize(function () {
            return new Promise(function (ignore, reject) {
                setTimeout(() => reject("failed"));
            });
        })(
            function (value, reason) {
                assert.equal(value, undefined, "value should be undefined");
                assert.equal(
                    reason.message,
                    (
                        "parseq.promise_requestorize: Failed when "
                        + "executing promise"
                    ),
                    "reason should be failed"
                );
                assert.equal(
                    reason.evidence,
                    "failed",
                    "reason should be failed"
                );
                done();
            }
        );
    }
);

test(
    "dynamic default imports are imported as requestors",
    function (ignore, done) {
        parseq_extended.dynamic_default_import("./dynamic_default_import.js")(
            function my_callback(value, reason) {
                assert.equal(
                    reason,
                    undefined,
                    "reason should be undefined"
                );
                assert.equal(value?.sample, true, "sample should be true");
                done();
            }
        );
    }
);

test("dynamic failing default imports are detected", function (ignore, done) {
    parseq_extended.dynamic_default_import("./failing_import.js")(
        function my_callback(value, reason) {
            assert.equal(value, undefined, "value should be undefined");
            assert.equal(
                typeof reason,
                "object",
                "reason should be an object"
            );
            assert.equal(
                reason.message,
                (
                    "parseq.promise_requestorize: Failed when importing "
                    + "./failing_import.js"
                ),
                "a reason should include a message"
            );
            assert.equal(
                reason.evidence.message,
                "non_existent_function is not defined",
                "a reason should include a message"
            );
            done();
        }
    );
});

test(
    "dynamic non-default imports are imported as requestors",
    function (ignore, done) {
        parseq_extended.dynamic_import("./dynamic_import.js")(
            function my_callback(value, reason) {
                assert.equal(
                    reason,
                    undefined,
                    "reason should be undefined"
                );
                assert.equal(value?.sample, true, "sample should be true");
                done();
            }
        );
    }
);

test(
    "delay requestor should execute unary function at least after x ms",
    function (ignore, done) {
        const delay1s = (unary) => parseq_extended.delay(
            parseq_extended.requestorize(unary),
            1000
        );
        const unary = (v) => v + 1;

        const start = Date.now();

        delay1s(unary)(function (value, reason) {
            assert.ok(value !== undefined, reason);
            assert.equal(value, 2);
            assert.ok(Date.now() - start >= 1000);
            done();
        }, 1);
    }
);

test(
    "a factory should pass all the relevant parameters to the requestor",
    function (ignore, done) {
        parseq_extended.factory_maker(parseq_extended.requestorize((v) => v))(
            function adapt_parameters(
/*jslint-disable*/
                v
/*jslint-enable*/
            ) {
                return {
/*jslint-disable*/
                    ...v,
/*jslint-enable*/
                    w: 2
                };
            }
        )(
            function callback(value, reason) {
                assert.ok(value !== undefined, reason);
                done(assert.deepEqual(value, {v: 1, w: 2}));
            },
            {v: 1}
        );
    }
);

test(
    "default factory combiner should combine online value with offline values",
    function (ignore, done) {
        parseq_extended.factory_maker(
            parseq_extended.requestorize((v) => v)
        )({w: 2})(
            function callback(value, reason) {
                assert.ok(value !== undefined, reason);
                done(assert.deepEqual(value, Object.assign(
                    Object.create(null),
                    {v: 1, w: 2}
                )));
            },
            {v: 1}
        );
    }
);

test(
    "Callback exceptions in a promise must be uncaught - generic promise",
    function (ignore, done) {
        hasThrown(
            "unhandledRejection",
            "generic promise failed!",
            done
        );
        parseq_extended.sequence([
            parseq_extended.promise_requestorize(a_little_promise_thunk)
        ])(
            function (value, reason) {
                assert.ok(value !== undefined, reason);
                throw my_error("generic promise failed!");
            }
        );
    }
);

test(
    "Callback exceptions in a promise context must be uncaught - import",
    function (ignore, done) {
        hasThrown("unhandledRejection", "Callback failed in import", done);

        parseq_extended.sequence([
            parseq_extended.dynamic_import("./dynamic_import.js")
        ])(
            function my_callback(value, reason) {
                assert.ok(value !== undefined, reason);
                throw my_error("Callback failed in import");
            }
        );
    }
);

test(
    "Callback exceptions in a promise must be uncaught - default import",
    function (ignore, done) {
        hasThrown(
            "unhandledRejection",
            "Callback failed in default import",
            done
        );

        parseq_extended.sequence([
            parseq_extended.dynamic_import("./dynamic_default_import.js")
        ])(
            function my_callback(value, reason) {
                assert.ok(value !== undefined, reason);
                throw my_error("Callback failed in default import");
            }
        );
    }
);

test(
    "Callback exceptions in a promise must be uncaught- import without factory",
    function (ignore, done) {
        hasThrown(
            "unhandledRejection",
            "Callback failed in import without factory",
            done
        );

        parseq_extended.dynamic_import("./dynamic_import.js")(
            function my_callback(value, reason) {
                assert.ok(value !== undefined, reason);
                throw my_error("Callback failed in import without factory");
            }
        );
    }
);

test(
    "Callback exceptions in promise must be uncaught - default without factory",
    function (ignore, done) {
        hasThrown(
            "uncaughtException",
            "Callback failed in default import without factory",
            done
        );

        parseq_extended.dynamic_default_import("./dynamic_default_import.js")(
            function my_callback(value, reason) {
                assert.ok(value !== undefined, reason);
                throw my_error(
                    "Callback failed in default import without factory"
                );
            }
        );
    }
);

test(
    "Final callback exceptions must crash the program",
    function (ignore, done) {
        hasThrown("uncaughtException", "Boom!", done);

        let count = 0;

        parseq_extended.sequence([
            parseq_extended.sequence([
                parseq_extended.constant(5)
            ])
        ])(
            function (value, reason) {
                assert.ok(value !== undefined, reason);
                if (count) {
                    throw new Error("callback called twice");
                }
                count += 1;
                throw my_error("Boom!");
            }
        );
    }
);

test(
    "parseq should provide a requestor to merge properties to a value",
    function (ignore, done) {
        parseq_extended.parallel_merge({
            prop_one: parseq_extended.constant(1),
            prop_two: parseq_extended.requestorize(
                ({prop_zero}) => prop_zero + 5
            )
        })(
            function (value, reason) {
                assert.ok(value !== undefined, reason);
                const expected = Object.assign(
                    Object.create(null),
                    {
                        prop_one: 1,
                        prop_two: 5,
                        prop_zero: 0
                    }
                );
                done(assert.deepEqual(value, expected));
            },
            {prop_zero: 0}
        );
    }
);

test("try-catcher catches requestor errors", function (ignore, done) {
    parseq_extended.sequence([
        parseq_extended.constant(null),
        parseq_extended.apply_parallel_object(
            parseq_extended.factory_maker(
                parseq_extended.requestorize((x) => x + 1),
                "sum"
            )
        )
    ])(function (value, reason) {
        assert.equal(value, undefined, "failed eventual task");
        assert.notEqual(reason.evidence, undefined, "evidence explains");
        assert.deepEqual(
            reason.evidence.message,
            "Cannot convert undefined or null to object",
            "error is caught"
        );
        done(assert.deepEqual(
            reason.message,
            "parseq.apply_parallel_object: caught requestor error null",
            "it should signal a catch"
        ));
    });
});

test(
    "tap executes requestor for only its side effects",
    function (ignore, done) {
        parseq_extended.sequence([
            parseq_extended.constant(5),
            parseq_extended.tap(
                parseq_extended.delay(
                    parseq_extended.requestorize(function (value) {
                        assert.equal(value, 5);
                        return value + 1;
                    }),
                    100
                )
            )
        ])(function (value, reason) {
            assert.ok(value !== undefined, reason);
            done(assert.equal(value, 5));
        });
    }
);

test(
    "tap still blocks eventual executions in case of errors",
    function (ignore, done) {
        parseq_extended.sequence([
            parseq_extended.constant(5),
            parseq_extended.tap(
                parseq_extended.delay(
                    parseq_extended.requestorize(function () {
                        throw "Boom!";
                    }),
                    100
                )
            ),
            parseq_extended.do_nothing
        ])(function (value, reason) {
            assert.equal(value, undefined);
            done(assert.equal(reason.evidence, "Boom!"));
        });
    }
);

test("Reduce without throttle is like parallel", function (ignore, done) {
    const reducer = (acc, x) => acc + x;
    parseq_extended.reduce(
        reducer,
        0,
        [
            parseq_extended.constant(3),
            parseq_extended.constant(5),
            parseq_extended.constant(7),
            parseq_extended.constant(3)
        ]
    )(function (value, reason) {
        assert.ok(value !== undefined, reason);
        done(assert.equal(value, 18));
    });
});

test("Reduce with throttle = 1", function (ignore, done) {
    const reducer = (acc, x) => acc + x;
    parseq_extended.reduce(
        reducer,
        0,
        [
            parseq_extended.constant(3),
            parseq_extended.constant(5),
            parseq_extended.constant(7),
            parseq_extended.constant(3)
        ],
        1
    )(function (value, reason) {
        assert.ok(value !== undefined, reason);
        done(assert.equal(value, 18));
    });
});

test("Reduce with throttle = 3", function (ignore, done) {
    const throttle = 3;
    const reducer = function (acc, x, ignore, array) {
        assert.equal(array.length, throttle);
        return acc + x;
    };
    parseq_extended.reduce(
        reducer,
        0,
        [
            parseq_extended.constant(3),
            parseq_extended.constant(5),
            parseq_extended.constant(7),
            parseq_extended.constant(3),
            parseq_extended.constant(5),
            parseq_extended.constant(7),
            parseq_extended.constant(3),
            parseq_extended.constant(5),
            parseq_extended.constant(7),
            parseq_extended.constant(3),
            parseq_extended.constant(5),
            parseq_extended.constant(7),
            parseq_extended.constant(3),
            parseq_extended.constant(5),
            parseq_extended.constant(7)
        ],
        throttle
    )(function (value, reason) {
        assert.ok(value !== undefined, reason);
        done(assert.equal(value, 75));
    });
});

test("Merge a factory", function (ignore, done) {
    const initial = {a: 1};
    const c = 2;
    function my_requestor(callback, {a, c}) {
        const id = setTimeout(function () {
            return callback(a + 1 + c);
        }, 0);
        return function () {
            clearTimeout(id);
        };
    }
    const my_factory = parseq_extended.factory_maker(my_requestor);
    parseq_extended.sequence([
        parseq_extended.parallel_merge({b: my_factory(function ({a}) {
            return {
                a,
                c
            };
        })})
    ])(function (value, ignore) {
        done(assert.deepEqual(
            value,
            Object.assign(Object.create(null), {a: 1, b: 4})
        ));
    }, initial);
});

test("Merge factories", function (ignore, done) {
    const initial = {a: 1};
    const c = 2;
    function my_requestor(callback, {a, c}) {
        const id = setTimeout(function () {
            return callback(a + 1 + c);
        }, 0);
        return function () {
            clearTimeout(id);
        };
    }
    const my_factory = parseq_extended.factory_maker(my_requestor);
    parseq_extended.sequence([
        parseq_extended.parallel_merge({
            b: my_factory(function ({a}) {
                return {
                    a,
                    c,
                    q: 3
                };
            }),
            f: my_factory(function ({a}) {
                return {
                    a,
                    c,
                    z: 55
                };
            })
        })
    ])(function (value, ignore) {
        done(assert.deepEqual(
            value,
            Object.assign(Object.create(null), {a: 1, b: 4, f: 4})
        ));
    }, initial);
});

test("Retry 3 times", function (ignore, done) {
    let tentatives = 0;
    const my_requestor = parseq_extended.requestorize(function () {
        tentatives += 1;
        if (tentatives < 4) {
            throw "Boom!";
        }
        return true;
    });

    parseq_extended.persist(my_requestor, 4)(function (value, ignore) {
        assert.equal(tentatives, 4);
        done(assert.ok(value));
    });
});

test(
    "Retry 3 times wih 1 seconds delay should complete after 3 seconds",
    function (ignore, done) {
        let tentatives = 0;
        const my_requestor = parseq_extended.requestorize(function () {
            tentatives += 1;
            if (tentatives < 4) {
                throw "Boom!";
            }
            return true;
        });

        const test_subject = parseq_extended.persist(my_requestor, 4, 1000);


        parseq_extended.race([
            parseq_extended.delay(
                parseq_extended.requestorize(() => "delay"),
                1000 * (3 - 0.005)
            ),
            test_subject
        ])(function (value, ignore) {
            assert.equal(tentatives, 3);
            done(assert.equal("delay", value));
        });
    }
);

test(
    "Retry 3 times wih 1 seconds delay should complete before 4 seconds",
    function (ignore, done) {
        let tentatives = 0;
        const my_requestor = parseq_extended.requestorize(function () {
            tentatives += 1;
            if (tentatives < 4) {
                throw "Boom!";
            }
            return true;
        });

        const test_subject = parseq_extended.persist(my_requestor, 4, 1000);

        parseq_extended.race([
            parseq_extended.delay(
                parseq_extended.requestorize(() => "delay"),
                1000 * (4 - 0.005)
            ),
            test_subject
        ])(function (value, ignore) {
            assert.equal(tentatives, 4);
            assert.ok(value);
            done(assert.notEqual("delay", value));
        });
    }
);

test.only(
    "try to have a resonable output when errors occur",
    function (ignore, done) {
        parseq_extended.parallel([
            function (c) {
                const id = setTimeout(function () {
                    return c(true);
                }, 0);
                return function () {
                    clearTimeout(id);
                };
            },
            parseq_extended.requestorize(function () {return;}, "first"),
            parseq_extended.requestorize(function () {throw "e";}, "second")
        ], {throttle: 1, name: "main"})(function (value, reason) {
            if (value === undefined) {
                console.log("REASON ", reason);
            }
            console.log("VALUE ", value);
                done(true);
        });
    }
);

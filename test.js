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
import test from "node:test";
import assert from "node:assert/strict";
import parseq_extended from "./parseq-extended.js";
import parseq from "./parseq.js";

function requestor_fail(callback) {
    callback(undefined, "failed");
}

const a_little_promise = new Promise(function (resolve) {
    setTimeout(() => resolve("success"));
});

test("parseq-extended should include parseq", function (t) {
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

test("wrap_reason should encapsulate reasons", function (t) {
    parseq_extended.parallel(
        [parseq_extended.wrap_reason(requestor_fail)]
    )(function (value, ignore) {
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
    });
});

test("constant must return a constant", function (t) {
    parseq_extended.constant(5)(function (value, ignore) {
        assert.equal(value, 5, "it should be five");
    });
});

test("do nothing just passes a value", function (t) {
    parseq_extended.sequence([
        parseq_extended.constant(5),
        parseq_extended.do_nothing
    ])(function (value, ignore) {
        assert.equal(value, 5, "it should be five");
    });
});

test(
    "Requestorize transforms an unary function into a requestor",
    function (t) {
        parseq_extended.sequence([
            parseq_extended.constant(5),
            parseq_extended.requestorize((x) => x + 1)
        ])(function (value, ignore) {
            assert.equal(value, 6, "it should be six");
        });
    }
);

test("Map a requestor into an array", function (t) {
    parseq_extended.sequence([
        parseq_extended.constant([1, 2, 3]),
        parseq_extended.when(
            (v) => v.length === 3,
            parseq_extended.apply_parallel(
                parseq_extended.wrap_requestor(
                    parseq_extended.requestorize((x) => x + 1)
                )
            )
        )
    ])(function (value, ignore) {
        assert.deepEqual(value, [2, 3, 4], "it should be [2, 3, 4]");
    });
});

test("Map a requestor into an object", function (t) {
    parseq_extended.sequence([
        parseq_extended.constant({a: 1, b: 2, c: 3}),
        parseq_extended.when(
            (v) => Object.keys(v).length === 3,
            parseq_extended.apply_parallel_object(
                parseq_extended.wrap_requestor(
                    parseq_extended.requestorize((x) => x + 1)
                )
            )
        )
    ])(function (value, ignore) {
        assert.deepEqual(
            value,
            Object.assign(Object.create(null), {a: 2, b: 3, c: 4}),
            "it should be {a: 2, b: 3, c: 4}"
        );
    });
});

test("Map an array to a fallback", function (t) {
    parseq_extended.sequence([
        parseq_extended.constant([0, 1, 2]),
        parseq_extended.apply_fallback(
            parseq_extended.wrap_requestor(
                parseq_extended.when((v) => v === 0, requestor_fail)
            )
        )
    ])(function (value, ignore) {
        assert.deepEqual(value, 1, "it should be 1");
    });
});

test("Map timeouts to a race", function (t) {
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
        assert.equal(value, "success 500", "timeout 500 should win");
    });
});

test("Map timeouts to a failing race", function (t) {
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
        assert.equal(value, undefined, "nobody should win");
        assert.equal(
            reason.toString(),
            "Error: parseq.race: Timeout.",
            "time_limit reached"
        );
        assert.equal(reason.evidence, 100, "time_limit");
    });
});

test("A promise becomes a requestor", function (t) {
    parseq_extended.promise_requestorize(a_little_promise)(
        function (value) {
            assert.equal(value, "success", "value should be success");
        }
    );
    const another_little_promise = new Promise(function (ignore, reject) {
        setTimeout(() => reject("failed"));
    });
    parseq_extended.promise_requestorize(another_little_promise)(
        function (value, reason) {
            assert.equal(value, undefined, "value should be undefined");
            assert.equal(
                reason.message,
                "Failed when executing promise",
                "reason should be failed"
            );
            assert.equal(
                reason.evidence,
                "failed",
                "reason should be failed"
            );
        }
    );
});

test("dynamic default imports are imported as requestors", function (t) {
    parseq_extended.dynamic_default_import("./dynamic_default_import.js")(
        function my_callback(value, reason) {
            assert.equal(reason, undefined, "reason should be undefined");
            assert.equal(value?.sample, true, "sample should be true");
        }
    );
});

test("dynamic failing default imports are detected", function (t) {
    parseq_extended.dynamic_default_import("./failing_import.js")(
        function my_callback(value, reason) {
            assert.equal(value, undefined, "value should be undefined");
            assert.equal(typeof reason, "object", "reason should be an object");
            assert.equal(
                reason.message,
                "Failed when importing ./failing_import.js",
                "a reason should include a message"
            );
            assert.equal(
                reason.evidence.message,
                "non_existent_function is not defined",
                "a reason should include a message"
            );
        }
    );
});

test("dynamic nondefault imports are imported as requestors", function (t) {
    parseq_extended.dynamic_import("./dynamic_import.js")(
        function my_callback(value, reason) {
            assert.equal(reason, undefined, "reason should be undefined");
            assert.equal(value?.sample, true, "sample should be true");
        }
    );
});

//Not so sure anymore...see https://github.com/douglascrockford/parseq/issues/13
// test(
//     "Callback exceptions in a promise context must be uncaught - generic promise",
//     function (t) {
//         let flag = false;
//         setTimeout(function () {
//             process.removeListener("uncaughtException", listener);
//             assert.equal(flag, true);
//         }, 1000);
//         const listener = function (err) {
//             if (err.message === "generic promise failed!") {
//                 process.removeListener("uncaughtException", listener);
//                 flag = true;
//             }
//         };
//         process.on("uncaughtException", listener);

//         parseq_extended.sequence([
//             parseq_extended.promise_requestorize(a_little_promise)
//         ])(
//             function (value, ignore) {
//                 throw new Error("generic promise failed!");
//             }
//         );
//     }
// );

// test(
//     "Callback exceptions in a promise context must be uncaught - import",
//     function (t) {
//         let flag = false;
//         setTimeout(function () {
//             process.removeListener("uncaughtException", listener);
//             assert.equal(flag, true, "Callback should throw");
//         }, 1000);
//         const listener = function (err) {
//             if (err.message === "Callback failed in import") {
//                 process.removeListener("uncaughtException", listener);
//                 flag = true;
//             }
//         };
//         process.on("uncaughtException", listener);

//         parseq_extended.sequence([
//             parseq_extended.dynamic_import("./dynamic_import.js")
//         ])(function my_callback(value, reason) {
//             throw new Error("Callback failed in import");
//         });
//     }
// );

// test(
//     "Callback exceptions in a promise context must be uncaught - default import",
//     function (t) {
//         let flag = false;
//         setTimeout(function () {
//             process.removeListener("uncaughtException", listener);
//             assert.equal(flag, true, "Callback should throw");
//         }, 1000);
//         const listener = function (err) {
//             if (err.message === "Callback failed in default import") {
//                 process.removeListener("uncaughtException", listener);
//                 flag = true;
//             }
//         };
//         process.on("uncaughtException", listener);

//         parseq_extended.sequence([
//             parseq_extended.dynamic_import("./dynamic_default_import.js")
//         ])(function my_callback(value, reason) {
//             throw new Error("Callback failed in default import");
//         });
//     }
// );

// test("Callback exceptions in a promise context must be uncaught - import without factory", function (t) {
//     let flag = false;
//     setTimeout(function () {
//         assert.equal(flag, true, "Callback should throw");
//     }, 1000);
//     const listener = function (err) {
//         if (err.message === "Callback failed in import without factory") {
//             process.removeListener("uncaughtException", listener);
//             flag = true;
//         }
//     };
//     process.on("uncaughtException", listener);
//     parseq_extended.dynamic_import("./dynamic_import.js")(
//         function my_callback(value, reason) {
//             throw new Error("Callback failed in import without factory");
//         }
//     );
// });

// test("Callback exceptions in a promise context must be uncaught - default import without factory", function (t) {
//     let flag = false;
//     setTimeout(function () {
//         assert.equal(flag, true, "Callback should throw");
//     }, 1000);
//     const listener = function (err) {
//         if (err.message === "Callback failed in default import without factory") {
//             process.removeListener("uncaughtException", listener);
//             flag = true;
//         }
//     };
//     process.on("uncaughtException", listener);
//     parseq_extended.dynamic_default_import("./dynamic_default_import.js")(
//         function my_callback(value, reason) {
//             throw new Error("Callback failed in default import without factory");
//         }
//     );
// });

// test("Callback exceptions must be uncaught", function (t) {
//     let flag = false;
//     setTimeout(function () {
//         assert.equal(flag, true, "Callback should throw");
//     }, 1000);
//     const listener = function (err) {
//         if (err.message === "Callback error") {
//             process.removeListener("uncaughtException", listener);
//             flag = true;
//         }
//     };
//     process.on("uncaughtException", listener);

//     parseq_extended.sequence([
//         parseq_extended.constant(1)
//     ])(function my_callback(value, reason) {
//         throw new Error("Callback error");
//     });
// });

test("Callback exceptions must be...no idea", function (t) {
    parseq.sequence([
        function requestor(callback) {
            callback(1);
        }
    ])(function (value, reason) {
        console.count("pass");
        if (value === undefined) {
            console.log("There is a failure");
            return console.log(reason);
        }
        throw new Error("Booom!");
    });
});

test("Callback exceptions must be...no idea (2)", function (t) {
    parseq.sequence([
        parseq.sequence([
            function requestor(callback) {
                callback(1);
            }
        ])
    ])(function (value, reason) {
        console.count("pass");
        if (value === undefined) {
            console.log("There is a failure");
            return console.log(reason);
        }
        throw new Error("Booom!");
    });
});

test("Callback exceptions must be...no idea (3)", function (t) {
    parseq.sequence([
        parseq.requestorize(function unary() {
            return 1;
        })
    ])(function (value, reason) {
        console.count("pass");
        if (value === undefined) {
            console.log("There is a failure");
            return console.log(reason);
        }
        throw new Error("Booom!");
    });
});

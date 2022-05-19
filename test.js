import test from "./test_framework.js";
import parseq_extended from "./extended.js";
import parseq from "./parseq.js";


function requestor_success(callback, value) {
    callback("success");
    return function cancel() {
    };
}

function requestor_fail(callback, value) {
    callback(undefined, "failed");
    return function cancel() {
    };
}

test("parseq-extended should include parseq", function (assert) {
    {
        assert.same(
            parseq_extended.sequence,
            parseq.sequence,
            "sequence should be in parseq extended"
        );
    }

    {
        assert.same(
            parseq_extended.parallel,
            parseq.parallel,
            "parallel should be in parseq extended"
        );
    }
    {
        assert.same(
            parseq_extended.fallback,
            parseq.fallback,
            "fallback should be in parseq extended"
        );
    }
    {
        assert.same(
            parseq_extended.parallel_object,
            parseq.parallel_object,
            "parallel_object should be in parseq extended"
        );
    }
    {
        assert.same(
            parseq_extended.race,
            parseq.race,
            "race should be in parseq extended"
        );
    }

});

test("optional_parallel should forward reasons", function (assert) {
    parseq_extended.parallel(
        [parseq_extended.wrap_reason(requestor_fail)]
    )(function (value, reason) {
        assert.same(Array.isArray(value), true, "value is array");
        assert.same(value.length, 1, "value is wun element array");
        assert.same(typeof (value[0]), "object", "value element is an object");
        const keys = Object.keys(value[0]);
        assert.same(keys.length, 2, "two keys in the return object");
        assert.deep_equal(keys, ["value", "reason"], "value and reason are the value keys");
        assert.deep_equal(
            value[0],
            {value: undefined, reason: "failed"},
            "The returned object should be the wun expected"
        );
    });
});

test("constant must return a constant", function(assert) {
    parseq_extended.constant(5)(function (value, ignore) {
        assert.same(value, 5, "it should be five");
    });
});

test("do nothing just passes a value", function(assert) {
    parseq_extended.sequence([
        parseq_extended.constant(5),
        parseq_extended.do_nothing
    ])(function (value, ignore) {
        assert.same(value, 5, "it should be five");
    });
});

test(
    "Requestorize transforms an unary function into a requestor",
    function(assert) {
        parseq_extended.sequence([
            parseq_extended.constant(5),
            parseq_extended.requestorize((x) => x + 1)
        ])(function (value, ignore) {
            assert.same(value, 6, "it should be six");
        });
    }
);

test("Map a requestor into an array", function(assert) {
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
        assert.deep_equal(
            value,
            [2, 3, 4],
            "it should be [2, 3, 4]"
        );
    });
});

test("Map a requestor into an object", function(assert) {
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
        assert.deep_equal(
            value,
            Object.assign(Object.create(null), {a: 2, b: 3, c: 4}),
            "it should be {a: 2, b: 3, c: 4}"
        );
    });
});

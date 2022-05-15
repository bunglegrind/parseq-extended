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

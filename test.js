import test from "./test_framework.js";
import parseq_extended from "./extended.js";
import parseq from "./parseq.js";

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

/*jslint
    node, unordered
*/
/*property
    deepEqual, deep_equal, equal, freeze, log, same
*/
import assert from "assert/strict";

let test_number = 1;

export default Object.freeze(function test(component, fn, count = 1) {
    let test = test_number;
    test_number += 1;
    console.log(`# test ${test} ${component}`);
    fn({
        same: function same(actual, expected, msg) {
            try {
                assert.equal(actual, expected, msg);
                console.log(`ok test ${test} assertion ${count} - ${msg}`);
            } catch (e) {
                console.log(`ko test ${test} assertion ${count} - ${msg}`);
                console.log(e);
            }
            count += 1;
        },
        deep_equal: function deep_equal(actual, expected, msg) {
            try {
                assert.deepEqual(actual, expected, msg);
                console.log(`ok test ${test} assertion ${count} - ${msg}`);
            } catch (e) {
                console.log(`ko test ${test} assertion ${count} - ${msg}`);
                console.log(e);
            }
            count += 1;
        }
    });
});

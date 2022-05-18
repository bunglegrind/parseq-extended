import assert from "assert/strict";

export default Object.freeze(function test(component, fn, count = 1) {
  console.log(`# ${ component }`);
  fn({
      same: function same(actual, expected, msg) {
          try {
              assert.equal(actual,expected, msg);
              console.log(`ok ${ count } - ${ msg }`);
          } catch (e) {
              console.log(`ko ${ count } - ${ msg }`);
              console.log(e);
          }
          count += 1;
      },
      deep_equal: function deep_equal(actual, expected, msg) {
          try {
              assert.deepEqual(actual, expected, msg);
              console.log(`ok ${ count } - ${ msg }`);
          } catch (e) {
              console.log(`ko ${ count } - ${ msg }`);
              console.log(e);
          }
          count += 1;
      }
  });
});

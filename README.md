# Parseq Extended

Please check the original parseq repository at: https://github.com/douglascrockford/parseq

Differences between the original parseq library:

1. make\_reason is exposed through the public interface
1. check\_callback is exposed through the public interface
1. check\_requestors is exposed through the public interface
1. start\_requestor\_callback doesn't catch exceptions anymore (see #13)

# More constraints

In order to have a more robust library, I added some more constraints to the original library:

1. requestors are executed in a different turn. Executing requestors in the same turn of the caller increases the possibility of issues like #13, and the possibility to exhaust the call stack
1. All the requestor (config) parameters must be passed through the value arriving from its second argument. It's arbitrary but I need to take a stance, otherwise confusion increases.
1. Every concrete factory/requestor must have its own name. Since call stacks are destroyed between turns, there's no other way than having a reliable explicit reason (with factory name and evidence) to properly debug the code.


# Other useful factories

TODO: description

## Requestors
- do\_nothing

## Requestors transformers
- wrap\_reason
- when
- if\_else
- try\_catcher
- tap
- parallel\_merge
- reduce

## Requestors factories
- constant
- requestorize (a different implementation)
- apply\_race
- apply\_fallback
- apply\_parallel
- apply\_parallel\_object
- dynamic\_default\_import
- dynamic\_import
- delay
- promise\_requestorize

## Others
- make\_requestor\_factory
- factory\_maker
- factory\_merge

# Considerations/Open issues

1. Parseq original interface signature is a bit clunky. Expecially for the parallel stuff, throttle is the last parameter where it should be the first one. I couldn't find any practical use case for the other parameters, including the optional requestor array/object.  I could change the interface a little bit, by passing an option object, similar to: https://github.com/jlrwi/curried-parseq
1. Enforce some constraint to the "returned" value (i.e., the value passed to the callback). Well, since most of the time you have this value which is passed through the requestors via parseq.sequence as application state, probably is worth to enforce the value to be a an object (being the array a special case). And resorting to parallel\_object/parallel\_merge/factory\_merge to provide a consistent interface.
1. Provide a more coherent (with many more tests!) interface for reason/evidence in order to simplify debug operations where errors occur.

Work in progress...

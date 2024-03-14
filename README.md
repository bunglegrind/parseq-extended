# Parseq Extended

Please check the original parseq repository at: https://github.com/douglascrockford/parseq

Differences between the original parseq library:

1. `make_reason` is exposed through the public interface
1. `check_callback` is exposed through the public interface
1. `check_requestors` is exposed through the public interface
1. `start_requestor_callback` doesn't catch exceptions anymore (see #13)

# More constraints

In order to have a more robust library, I added some more constraints to the original library:

1. requestors are executed in a different turn. Executing requestors in the same turn of the caller increases the possibility of issues like #13, and the possibility to exhaust the call stack
1. All the requestor (config) parameters must be passed through the value arriving from its second argument. It's arbitrary but I need to take a stance, otherwise confusion increases. Using the helper function `factory_maker` you can adapt the interface in the different context.
1. Every concrete factory/requestor must have its own name. Since call stacks are destroyed between turns, there's no other way than having a reliable explicit reason (with factory name and evidence) to properly debug the code.


# Other useful factories
The functions available in this module are divided in three categories.

- requestors
- requestors decorators
- requestors factories
- others

The terminology herein utilized moves away from the original parseq library, since what parseq calls _requestor factories_ I called _requestor decorators_, i.e., a function which, given one or more requestors at its input, returns a new requestor. I used the term _requestor factories_ to identify functions which given some parameters, even other factories, return a requestor.
The _others_ category denotes functions which, given some parameters, return a requestor factory.
## Requestors
- `do_nothing`

## Requestors decorators
- `wrap_reason`
- `when`
- `if_else`
- `try_catcher`
- `tap`
- `parallel_merge`
- `reduce`

## Requestors factories
- `constant`
- `requestorize`
- `apply_race`
- `apply_fallback`
- `apply_parallel`
- `apply_parallel_object`
- `dynamic_default_import`
- `dynamic_import`
- `delay`
- `promise_requestorize`

## Others
- `make_requestor_factory`  
It's just a shortcut for the composition of requestorize and factory\_maker
- `factory_maker`

# Considerations/Open issues

1. Parseq original interface signature is a bit clunky. Expecially for the parallel stuff, throttle is the last parameter where it should be the first one. I couldn't find any practical use case for the other parameters, including the optional requestor array/object.  I could change the interface a little bit, by passing an option object, similar to: https://github.com/jlrwi/curried-parseq
1. Enforce some constraint to the "returned" value (i.e., the value passed to the callback). Well, since most of the time you have this value which is passed through the requestors via parseq.sequence as application state, probably is worth to enforce the value to be a an object (being the array a special case). And resorting to parallel\_object/parallel\_merge/factory\_merge to provide a consistent interface.
1. Provide a more coherent (with many more tests!) interface for reason/evidence in order to simplify debug operations where errors occur.

Work in progress...

import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";

export const trySync = <A, E>(run: () => A): Effect.Effect<A, E> =>
  Effect.suspend(() => {
    try {
      return Effect.succeed(run());
    } catch (error) {
      return Effect.fail(error as E);
    }
  });

export const liveQueue = <T>(
  initial: ReadonlyArray<T>,
  subscribe: (listener: (item: T) => void) => () => void,
): Effect.Effect<Queue.Queue<T>, never, import("effect/Scope").Scope> =>
  Effect.gen(function* () {
    const queue = yield* Queue.make<T>();
    const unsubscribe = subscribe((item) => {
      Queue.offerUnsafe(queue, item);
    });
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        unsubscribe();
      }),
    );
    for (const item of initial) {
      yield* Queue.offer(queue, item);
    }
    return queue;
  });

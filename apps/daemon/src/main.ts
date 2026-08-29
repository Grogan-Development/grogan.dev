#!/usr/bin/env node
import * as Process from "node:process";

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { NodeRuntime } from "@effect/platform-node";

import { daemonLayer } from "./app.ts";
import { loadOptionsFromEnv } from "./runtime.ts";

const options = loadOptionsFromEnv();
const { layer, daemon } = daemonLayer(options);
Process.on("exit", () => {
  daemon.dispose();
});

NodeRuntime.runMain(
  Effect.gen(function* () {
    yield* Effect.log(
      `nero-daemon starting on ${options.host}:${options.port} cwd=${options.workspaceRoot}`,
    );
    return yield* Layer.launch(layer as Layer.Layer<never, never, never>);
  }),
);

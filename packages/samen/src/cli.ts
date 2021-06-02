#!/usr/bin/env node

import { getEnvironment, handleError } from "@samen/core"

import serve from "./commands/serve"
import build from "./commands/build"

process.on("unhandledRejection", handleError)

try {
  const environment = getEnvironment()

  switch (process.argv[2]) {
    case "serve":
      serve(environment)
      break

    case "build":
      const isDebugFlag = process.argv.includes("--debug")
      build(environment, isDebugFlag)
      break

    default:
      throw new Error(`Unknown command: ${process.argv[2]}`)
  }
} catch (error) {
  handleError(error)
}
